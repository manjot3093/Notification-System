const { nanoid } = require('nanoid');
const { EventEmitter } = require('events');
const db = require('../db');

// Broadcaster for real-time push (SSE). createNotification() emits on this
// after every insert; the SSE route in routes/notifications.js subscribes
// and forwards matching events to connected browser clients. This is what
// lets the bell update instantly instead of waiting on a poll or a refresh.
const notificationEvents = new EventEmitter();
notificationEvents.setMaxListeners(0); // many browser tabs may subscribe at once

/**
 * Single source of truth for creating a notification.
 *
 * This is intentionally the ONLY place that writes a new notification row.
 * The plain POST /notifications endpoint calls this, and every trigger/webhook
 * in src/triggers also calls this — so notification-creation logic is never
 * duplicated or hardcoded into one call site. In a real product, this is the
 * function you'd call from anywhere in your codebase (event handlers, queue
 * consumers, cron jobs, etc.) whenever something notification-worthy happens.
 *
 * @param {Object} params
 * @param {string} params.tenantId - required, scopes the notification
 * @param {string|null} [params.userId] - null = tenant-wide, else a specific user
 * @param {string} params.type - machine-readable event type, e.g. "new_reply"
 * @param {string} params.title
 * @param {string} params.body
 * @returns {Object} the created notification
 */
function createNotification({ tenantId, userId = null, type, title, body }) {
  if (!tenantId) throw new Error('tenantId is required');
  if (!type) throw new Error('type is required');
  if (!title) throw new Error('title is required');
  if (!body) throw new Error('body is required');

  const notification = {
    id: nanoid(),
    tenantId,
    userId: userId ?? null,
    type,
    title,
    body,
    read: 0,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  db.prepare(`
    INSERT INTO notifications (id, tenantId, userId, type, title, body, read, createdAt, readAt)
    VALUES (@id, @tenantId, @userId, @type, @title, @body, @read, @createdAt, @readAt)
  `).run(notification);

  const apiShape = toApiShape(notification);
  notificationEvents.emit('created', apiShape);
  return apiShape;
}

function listVisibleNotifications({ tenantId, userId, page = 1, pageSize = 20 }) {
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(`
    SELECT * FROM notifications
    WHERE tenantId = @tenantId
      AND (userId IS NULL OR userId = @userId)
    ORDER BY read ASC, createdAt DESC
    LIMIT @pageSize OFFSET @offset
  `).all({ tenantId, userId, pageSize, offset });

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM notifications
    WHERE tenantId = @tenantId
      AND (userId IS NULL OR userId = @userId)
  `).get({ tenantId, userId });

  return {
    notifications: rows.map(toApiShape),
    page,
    pageSize,
    total,
  };
}

function getUnreadCount({ tenantId, userId }) {
  const { count } = db.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE tenantId = @tenantId
      AND (userId IS NULL OR userId = @userId)
      AND read = 0
  `).get({ tenantId, userId });
  return count;
}

/**
 * Marks a single notification read. Returns null if it doesn't exist OR
 * doesn't belong to the caller's tenant/visibility (so callers can 404).
 */
function markRead({ id, tenantId, userId }) {
  const row = db.prepare(`
    SELECT * FROM notifications
    WHERE id = @id AND tenantId = @tenantId AND (userId IS NULL OR userId = @userId)
  `).get({ id, tenantId, userId });

  if (!row) return null;

  const readAt = new Date().toISOString();
  db.prepare(`UPDATE notifications SET read = 1, readAt = @readAt WHERE id = @id`).run({ id, readAt });

  return toApiShape({ ...row, read: 1, readAt });
}

function markAllRead({ tenantId, userId }) {
  const readAt = new Date().toISOString();
  const result = db.prepare(`
    UPDATE notifications
    SET read = 1, readAt = @readAt
    WHERE tenantId = @tenantId
      AND (userId IS NULL OR userId = @userId)
      AND read = 0
  `).run({ tenantId, userId, readAt });

  return { updated: result.changes };
}

function toApiShape(row) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId ?? null,
    type: row.type,
    title: row.title,
    body: row.body,
    read: !!row.read,
    createdAt: row.createdAt,
    readAt: row.readAt ?? null,
  };
}

module.exports = {
  createNotification,
  listVisibleNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  notificationEvents,
};
