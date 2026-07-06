# Nova CRM — Notification System

A tenant-aware notification feature built end-to-end: backend API + SQLite,
two decoupled event triggers ("webhooks") that create notifications, and a
Vite + React frontend with a polling notification bell.

```
notification-system/
├── backend/     Express API + SQLite (node:sqlite) + trigger endpoints + tests
└── frontend/    Vite + React notification bell UI
```

---

## Quick start

Requires **Node.js 22.5+** (see "Why node:sqlite" below for why this matters).

### 1. Backend

```bash
cd backend
npm install
npm start
```

Runs on `http://localhost:4000`. On first run it creates `backend/data/notifications.db`
and seeds it with the four notifications from the challenge spec (`n1`–`n4`
across tenants `t1`/`t2`). Delete that file to reset to the seed state.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env   # points VITE_API_BASE_URL at http://localhost:4000
npm run dev
```

Opens on `http://localhost:5173`. Use the "Viewing as" dropdown in the header
to switch between demo identities (`t1`/`u1`, `t1`/`u2`, `t2`/`u3`) and watch
the bell only ever show that identity's own notifications.

### 3. Real-time updates — no refresh, no manual reload

The bell opens one Server-Sent Events (SSE) connection per identity
(`GET /notifications/stream`) and gets pushed a `notification` event the
instant anything visible to it is created — whether from `POST /notifications`
directly or from any `/webhooks/*` trigger. A small dot next to "Notifications"
in the panel header shows green when the stream is live. A 20s poll still
runs in the background purely as a reconciliation fallback in case the stream
drops (e.g. a proxy that blocks long-lived connections), but it's no longer
the primary way updates arrive.

### 4. Fire a trigger

The frontend has two buttons under "Fire a demo event" that hit the trigger
endpoints directly — no separate script needed. You can also curl them:

```bash
curl -X POST http://localhost:4000/webhooks/member-invited \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"t1","memberName":"Alex"}'

curl -X POST http://localhost:4000/webhooks/creator-replied \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"t1","userId":"u1","creatorName":"Jordan"}'
```

The bell polls every 20s, or just close/reopen the panel to refetch immediately.

### 5. Run the tests

```bash
cd backend
npm test
```

10 tests covering tenant isolation (list, unread-count, mark-read,
mark-all-read, id-guessing), the trigger pipeline, and the SSE stream
(auth guard, and that a push event only reaches listeners it's actually
visible to). All pass.

---

## API

All endpoints (except the trigger endpoints, which are internal-style) require
`X-Tenant-Id` and `X-User-Id` headers, standing in for real auth (see write-up
below).

| Method | Path                          | Notes                                              |
|--------|-------------------------------|-----------------------------------------------------|
| POST   | `/notifications`              | Create one directly (mostly for testing)            |
| GET    | `/notifications`               | List visible to caller — unread first, then newest  |
| GET    | `/notifications/unread-count` | Badge count                                         |
| GET    | `/notifications/stream`       | SSE push channel — auth via `?tenantId=&userId=` query params (browsers' `EventSource` can't send custom headers) |
| PATCH  | `/notifications/:id/read`     | Mark one read — 404s if not visible to caller        |
| PATCH  | `/notifications/read-all`     | Mark everything visible to caller as read           |
| POST   | `/webhooks/member-invited`    | Trigger demo #1 — tenant-wide notification          |
| POST   | `/webhooks/creator-replied`   | Trigger demo #2 — notification for one user         |
| POST   | `/webhooks/report-ready`      | Trigger demo #3 (bonus) — notification for one user |

The two/three webhook endpoints don't call the HTTP API internally — they call
`notificationService.createNotification()` directly, the same function
`POST /notifications` calls. That's the point being demonstrated: notification
creation is one small, reusable function, not logic duplicated per call site.

## Why `node:sqlite` instead of `better-sqlite3`/`sqlite3`

Both common SQLite drivers ship native addons that need `node-gyp` and a
prebuilt binary matching your exact Node version/OS/arch — a frequent source
of "works on my machine" install failures, and something I hit directly while
building this (a sandboxed environment without full internet access couldn't
fetch Node headers to compile them). Node 22.5+ ships a built-in `node:sqlite`
module with the same synchronous, prepared-statement API shape, so `npm
install` never needs to compile anything. If you're on an older Node, swapping
back to `better-sqlite3` is a ~10-line change in `backend/src/db.js` — the rest
of the code is unaffected.

---

## Integration write-up: fitting this into a real product

**Auth.** Right now `X-Tenant-Id`/`X-User-Id` headers are trusted as-is. In a
real product these would never be inputs — they'd be derived server-side from
a verified JWT (or session) in a single auth middleware, and every route would
keep using `req.tenantId`/`req.userId` exactly as they do now. The route and
service code wouldn't change at all; only `middleware/tenantAuth.js` would.

**Database.** I'd keep the schema (`tenantId`, `userId` nullable, `type`,
read/unread, timestamps) almost as-is — it already matches the multi-tenant
pattern most CRMs use — but move it into the product's existing Postgres/MySQL
database as a `notifications` table with a foreign key to the real tenants and
users tables, rather than a standalone SQLite file. `tenantId` should be
indexed (and likely part of a composed index with `userId`/`read`) since every
query filters on it; I already index for that shape here.

**Event system.** The core design decision I'd keep is the one already in
`notificationService.js`: **one function, `createNotification()`, is the only
thing that ever writes a row.** In a real product this function gets called
from wherever real events already happen — a Postgres trigger → outbox →
queue consumer, an internal event bus (Kafka/SQS/etc.), or simple in-process
event emitters on existing service methods (e.g. `dealsService.moveStage()`
calls `notify()` at the end). The two demo webhook endpoints here stand in for
those real call sites; the endpoints themselves are the part I'd throw away,
not the function they call.

**Delivery/read model.** I'd keep "unread first, then newest" and the
tenant-wide-vs-per-user (`userId: null` vs specific) model, since it covers
most real notification needs cheaply. What I'd redesign: pagination via
cursor/keyset instead of offset once volumes grow (offset pagination degrades
on large tenants), and I'd add a `notification_preferences` layer so users can
mute types, since a real CRM will eventually generate more `type`s than anyone
wants to see all of.

**Delivery beyond the bell.** The write path (`createNotification`) is
intentionally isolated from the read path (REST endpoints for the bell) — that
seam is where you'd hang additional delivery channels later (email digest,
Slack, push) without touching how notifications are created.

---

## What I'd do differently with more time

- **Real-time delivery is implemented** (SSE, see above) but I'd harden it
  further with more time: reconnect with backoff + a `Last-Event-ID` replay
  so a client that was briefly offline doesn't miss anything between
  disconnect and reconnect, rather than relying on the 20s fallback poll to
  catch up.
- **Cursor-based pagination** instead of offset-based, so `GET /notifications`
  stays fast as a tenant accumulates thousands of rows.
- **Notification preferences/muting per type**, so tenant-wide noise (e.g.
  every `member_invited`) doesn't drown out things addressed to you.
- **A queue between trigger and creation** (even a simple in-memory one) so a
  burst of events doesn't block the caller on a synchronous DB write — more
  important once triggers come from high-volume sources like message ingestion.
- **Idempotency keys** on notification creation, so a retried webhook/event
  can't create a duplicate notification.
- **E2E test against the frontend** (Playwright) rather than only backend
  tests — the isolation tests here cover the API contract, but not that the
  bell renders/polls/marks-read correctly end-to-end in a browser.
