const fs = require('fs');
const path = require('path');
const os = require('os');

// Point the app at a fresh, throwaway SQLite file for this test run so tests
// never touch the real dev database and are independent of each other.
const tmpDbPath = path.join(os.tmpdir(), `notifications-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.NOTIFICATIONS_DB_PATH = tmpDbPath;

const request = require('supertest');
const app = require('../src/server');

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    const f = tmpDbPath + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

describe('Tenant isolation', () => {
  test('a user in tenant t1 sees seeded n1, n2, n3 but never n4 (tenant t2)', async () => {
    const res = await request(app)
      .get('/notifications')
      .set('X-Tenant-Id', 't1')
      .set('X-User-Id', 'u1');

    expect(res.status).toBe(200);
    const ids = res.body.notifications.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(['n1', 'n2', 'n3']));
    expect(ids).not.toContain('n4');
  });

  test('unread-count for t1/u1 does not include tenant t2 notifications', async () => {
    const t1Count = await request(app)
      .get('/notifications/unread-count')
      .set('X-Tenant-Id', 't1')
      .set('X-User-Id', 'u1');

    const t2Count = await request(app)
      .get('/notifications/unread-count')
      .set('X-Tenant-Id', 't2')
      .set('X-User-Id', 'someone-else');

    // t1/u1 sees n1 (unread, tenant-wide) + n2 (unread, addressed to u1) = 2
    expect(t1Count.body.count).toBe(2);
    // t2 sees n4 (unread, tenant-wide) = 1
    expect(t2Count.body.count).toBe(1);
  });

  test('a user in tenant t1 cannot mark tenant t2s notification (n4) as read', async () => {
    const res = await request(app)
      .patch('/notifications/n4/read')
      .set('X-Tenant-Id', 't1')
      .set('X-User-Id', 'u1');

    expect(res.status).toBe(404);

    // Confirm n4 is genuinely untouched by checking as its real tenant.
    const t2List = await request(app)
      .get('/notifications')
      .set('X-Tenant-Id', 't2')
      .set('X-User-Id', 'whoever');

    const n4 = t2List.body.notifications.find((n) => n.id === 'n4');
    expect(n4.read).toBe(false);
  });

  test('mark-all-read for t1/u1 never touches t2s notifications', async () => {
    await request(app)
      .patch('/notifications/read-all')
      .set('X-Tenant-Id', 't1')
      .set('X-User-Id', 'u1');

    const t2List = await request(app)
      .get('/notifications')
      .set('X-Tenant-Id', 't2')
      .set('X-User-Id', 'whoever');

    const n4 = t2List.body.notifications.find((n) => n.id === 'n4');
    expect(n4.read).toBe(false); // still untouched
  });

  test('a notification created for tenant t2 is invisible to tenant t1, even guessing the id', async () => {
    const created = await request(app)
      .post('/notifications')
      .set('X-Tenant-Id', 't2')
      .set('X-User-Id', 'someone')
      .send({ tenantId: 't2', userId: null, type: 'member_invited', title: 'X', body: 'Y' });

    expect(created.status).toBe(201);
    const newId = created.body.id;

    // t1 tries to fetch the full list and also tries to mark it read directly by id.
    const t1List = await request(app)
      .get('/notifications')
      .set('X-Tenant-Id', 't1')
      .set('X-User-Id', 'u1');
    expect(t1List.body.notifications.map((n) => n.id)).not.toContain(newId);

    const markAttempt = await request(app)
      .patch(`/notifications/${newId}/read`)
      .set('X-Tenant-Id', 't1')
      .set('X-User-Id', 'u1');
    expect(markAttempt.status).toBe(404);
  });

  test('missing auth headers are rejected', async () => {
    const res = await request(app).get('/notifications');
    expect(res.status).toBe(401);
  });
});

describe('Trigger pipeline creates correctly-scoped notifications', () => {
  test('member-invited trigger creates a tenant-wide notification visible to all tenant users', async () => {
    const trigger = await request(app)
      .post('/webhooks/member-invited')
      .send({ tenantId: 't1', memberName: 'Alex' });

    expect(trigger.status).toBe(201);
    expect(trigger.body.notification.userId).toBeNull();

    const asU1 = await request(app)
      .get('/notifications')
      .set('X-Tenant-Id', 't1')
      .set('X-User-Id', 'u1');
    const asU2 = await request(app)
      .get('/notifications')
      .set('X-Tenant-Id', 't1')
      .set('X-User-Id', 'some-other-user');

    const id = trigger.body.notification.id;
    expect(asU1.body.notifications.map((n) => n.id)).toContain(id);
    expect(asU2.body.notifications.map((n) => n.id)).toContain(id);
  });

  test('creator-replied trigger creates a notification addressed only to the specified user', async () => {
    const trigger = await request(app)
      .post('/webhooks/creator-replied')
      .send({ tenantId: 't1', userId: 'u1', creatorName: 'Jordan' });

    expect(trigger.status).toBe(201);
    const id = trigger.body.notification.id;

    const asU1 = await request(app)
      .get('/notifications')
      .set('X-Tenant-Id', 't1')
      .set('X-User-Id', 'u1');
    const asOtherUser = await request(app)
      .get('/notifications')
      .set('X-Tenant-Id', 't1')
      .set('X-User-Id', 'not-u1');

    expect(asU1.body.notifications.map((n) => n.id)).toContain(id);
    expect(asOtherUser.body.notifications.map((n) => n.id)).not.toContain(id);
  });
});

describe('Real-time SSE stream', () => {
  test('missing tenantId/userId query params are rejected', async () => {
    const res = await request(app).get('/notifications/stream');
    expect(res.status).toBe(401);
  });

  test('a connected t1 listener receives a notification created for t1, but a t2 listener does not', async () => {
    const http = require('http');
    const server = app.listen(0);
    const port = server.address().port;

    function openStream(tenantId, userId) {
      return new Promise((resolve) => {
        const events = [];
        const req = http.get(
          { host: 'localhost', port, path: `/notifications/stream?tenantId=${tenantId}&userId=${userId}` },
          (res) => {
            let buffer = '';
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              if (buffer.includes('event: notification')) {
                events.push(buffer);
                resolve({ events, req });
              }
            });
          }
        );
        // Give up waiting after 1.5s if nothing arrives (expected for the t2 case).
        setTimeout(() => resolve({ events, req }), 1500);
      });
    }

    const t1Promise = openStream('t1', 'u1');
    const t2Promise = openStream('t2', 'someone');

    // Give both streams a moment to actually connect before firing the trigger.
    await new Promise((r) => setTimeout(r, 200));

    await request(app)
      .post('/webhooks/member-invited')
      .send({ tenantId: 't1', memberName: 'Streamed Member' });

    const [t1Result, t2Result] = await Promise.all([t1Promise, t2Promise]);

    t1Result.req.destroy();
    t2Result.req.destroy();
    server.close();

    expect(t1Result.events.length).toBeGreaterThan(0);
    expect(t1Result.events[0]).toContain('Streamed Member');
    expect(t2Result.events.length).toBe(0);
  });
});
