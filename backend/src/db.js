const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// Using Node's built-in node:sqlite (available in Node >=22.5) instead of a
// third-party driver like better-sqlite3/sqlite3 on purpose: those ship native
// addons that need node-gyp + prebuilt binaries matching your exact
// Node/OS/arch, which is a common source of "works on my machine" install
// failures. node:sqlite ships with Node itself, so `npm install` never needs
// to compile anything. See README for the Node version requirement.

// Allow tests to point at an isolated, throwaway DB file (or ':memory:').
const DB_PATH = process.env.NOTIFICATIONS_DB_PATH || path.join(__dirname, '..', 'data', 'notifications.db');

if (DB_PATH !== ':memory:') {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    tenantId   TEXT NOT NULL,
    userId     TEXT,               -- NULL = visible to everyone in the tenant
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    read       INTEGER NOT NULL DEFAULT 0,
    createdAt  TEXT NOT NULL,
    readAt     TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications (tenantId);
  CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications (tenantId, userId);
`);

const SEED = [
  { id: 'n1', tenantId: 't1', userId: null, type: 'member_invited', title: 'New team member', body: 'Sarah joined Nova Talent', read: 0, createdAt: '2026-07-01T09:00:00Z', readAt: null },
  { id: 'n2', tenantId: 't1', userId: 'u1', type: 'new_reply', title: 'Creator replied', body: 'Priya Sharma replied to your outreach message', read: 0, createdAt: '2026-07-02T14:30:00Z', readAt: null },
  { id: 'n3', tenantId: 't1', userId: 'u1', type: 'report_ready', title: 'Report ready', body: 'Your July campaign report is ready to view', read: 1, createdAt: '2026-06-28T08:00:00Z', readAt: '2026-06-28T10:00:00Z' },
  { id: 'n4', tenantId: 't2', userId: null, type: 'member_invited', title: 'New team member', body: 'James joined Bright Star Agency', read: 0, createdAt: '2026-07-01T09:05:00Z', readAt: null },
];

function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM notifications').get();
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO notifications (id, tenantId, userId, type, title, body, read, createdAt, readAt)
      VALUES (@id, @tenantId, @userId, @type, @title, @body, @read, @createdAt, @readAt)
    `);
    db.exec('BEGIN');
    try {
      for (const row of SEED) insert.run(row);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

seedIfEmpty();

module.exports = db;
