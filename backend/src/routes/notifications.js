const express = require('express');
const { requireTenantAuth } = require('../middleware/tenantAuth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// GET /notifications/stream - Server-Sent Events push channel.
//
// This is registered BEFORE the X-Tenant-Id/X-User-Id header middleware
// because browsers' EventSource API cannot send custom request headers, so
// identity for this one route comes from query params instead (?tenantId=&userId=).
// In a real app with real JWT-based auth this would instead read an auth
// token from the query string (SSE's usual workaround) or use a short-lived
// signed stream ticket obtained via a normal authenticated request.
//
// The client opens this once and receives a `notification` event every time
// a notification visible to them is created — no polling delay, no refresh.
router.get('/stream', (req, res) => {
  const tenantId = req.query.tenantId;
  const userId = req.query.userId;

  if (!tenantId || !userId) {
    return res.status(401).json({ error: 'Missing tenantId and/or userId query params' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (e.g. nginx) so events flush immediately
  });
  res.write('\n');

  const onCreated = (notification) => {
    const visible = notification.tenantId === tenantId && (notification.userId === null || notification.userId === userId);
    if (!visible) return;
    res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
  };

  notificationService.notificationEvents.on('created', onCreated);

  // Keep the connection alive through proxies/load balancers that time out
  // idle connections.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    notificationService.notificationEvents.off('created', onCreated);
  });
});

router.use(requireTenantAuth);

// POST /notifications - create a notification.
// Called internally by trigger/webhook logic, but also works standalone for testing.
// Note: tenantId comes from the body here (a notification can target a DIFFERENT
// user's tenant than the caller, e.g. "notify tenant t1 that a reply came in") —
// this endpoint represents trusted server-to-server / internal creation, not an
// end-user-facing write. In production this route would typically be internal-only
// (service auth, not user auth) rather than reusing the user-facing tenant header.
router.post('/', (req, res) => {
  const { tenantId, userId = null, type, title, body } = req.body || {};

  if (!tenantId || !type || !title || !body) {
    return res.status(400).json({
      error: 'tenantId, type, title, and body are required',
    });
  }

  try {
    const notification = notificationService.createNotification({ tenantId, userId, type, title, body });
    return res.status(201).json(notification);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /notifications - list notifications visible to the caller, paginated,
// unread first then newest first.
router.get('/', (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);

  const result = notificationService.listVisibleNotifications({
    tenantId: req.tenantId,
    userId: req.userId,
    page,
    pageSize,
  });

  return res.json(result);
});

// GET /notifications/unread-count
router.get('/unread-count', (req, res) => {
  const count = notificationService.getUnreadCount({ tenantId: req.tenantId, userId: req.userId });
  return res.json({ count });
});

// PATCH /notifications/read-all
// NOTE: defined before /:id/read so Express doesn't treat "read-all" as an :id param.
router.patch('/read-all', (req, res) => {
  const result = notificationService.markAllRead({ tenantId: req.tenantId, userId: req.userId });
  return res.json(result);
});

// PATCH /notifications/:id/read - must belong to caller's tenant, else 404.
router.patch('/:id/read', (req, res) => {
  const updated = notificationService.markRead({
    id: req.params.id,
    tenantId: req.tenantId,
    userId: req.userId,
  });

  if (!updated) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  return res.json(updated);
});

module.exports = router;
