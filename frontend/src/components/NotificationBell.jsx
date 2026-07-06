import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsApi } from '../api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
// Fallback poll — only matters if the SSE connection is down (e.g. a proxy
// that doesn't support streaming). While SSE is connected this is basically
// a no-op reconciliation, not the primary delivery path anymore.
const FALLBACK_POLL_MS = 20000;

function relativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

const TYPE_ICON = {
  new_reply: '💬',
  member_invited: '👋',
  report_ready: '📊',
};

export default function NotificationBell({ tenantId, userId }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false); // whether the SSE stream is currently connected
  const containerRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [listRes, countRes] = await Promise.all([
        notificationsApi.list({ tenantId, userId, pageSize: 20 }),
        notificationsApi.unreadCount({ tenantId, userId }),
      ]);
      setNotifications(listRes.notifications);
      setUnreadCount(countRes.count);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId]);

  // Initial load + whenever the active tenant/user identity changes.
  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  // Real-time push: open one Server-Sent Events connection per identity.
  // Every notification created anywhere in the backend (POST /notifications,
  // or any /webhooks/* trigger) gets pushed here immediately if it's visible
  // to this tenant/user — no polling delay, no manual refresh needed.
  useEffect(() => {
    const url = `${API_BASE}/notifications/stream?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}`;
    const source = new EventSource(url);

    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false); // EventSource auto-reconnects on its own

    source.addEventListener('notification', (event) => {
      const notification = JSON.parse(event.data);
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev; // dedupe
        // Keep the "unread first, then newest" ordering the API uses.
        return [notification, ...prev].sort((a, b) => {
          if (a.read !== b.read) return a.read ? 1 : -1;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      });
      if (!notification.read) setUnreadCount((prev) => prev + 1);
    });

    return () => source.close();
  }, [tenantId, userId]);

  // Fallback/reconciliation poll — keeps things correct even if SSE is
  // blocked by network middleware, and quietly self-heals any drift.
  useEffect(() => {
    const interval = setInterval(fetchAll, FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Close the panel on outside click.
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleMarkRead(id) {
    // Optimistic update so the click feels instant.
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await notificationsApi.markRead({ tenantId, userId, id });
    } catch (err) {
      setError(err.message);
      fetchAll(); // reconcile on failure
    }
  }

  async function handleMarkAllRead() {
    const prevNotifications = notifications;
    const prevCount = unreadCount;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead({ tenantId, userId });
    } catch (err) {
      setError(err.message);
      setNotifications(prevNotifications);
      setUnreadCount(prevCount);
    }
  }

  return (
    <div className="bell-container" ref={containerRef}>
      <button
        className="bell-button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="menu">
          <div className="bell-panel-header">
            <span>
              Notifications
              <span className={`live-dot ${live ? 'is-live' : ''}`} title={live ? 'Live' : 'Reconnecting…'} />
            </span>
            <button
              className="mark-all-link"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          <div className="bell-panel-list">
            {loading && <div className="bell-empty">Loading…</div>}
            {!loading && error && <div className="bell-empty bell-error">Couldn't load notifications: {error}</div>}
            {!loading && !error && notifications.length === 0 && (
              <div className="bell-empty">Nothing here yet. You're all caught up.</div>
            )}
            {!loading &&
              !error &&
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={`bell-item ${n.read ? 'is-read' : 'is-unread'}`}
                  onClick={() => !n.read && handleMarkRead(n.id)}
                >
                  <span className="bell-item-icon">{TYPE_ICON[n.type] || '🔔'}</span>
                  <span className="bell-item-body">
                    <span className="bell-item-title">{n.title}</span>
                    <span className="bell-item-text">{n.body}</span>
                    <span className="bell-item-time">{relativeTime(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="bell-item-dot" aria-hidden="true" />}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5c-3.4 0-6 2.7-6 6.2v3.1c0 .7-.3 1.7-.7 2.3L4 16.2c-.8 1.1 0 2.7 1.4 2.7h13.2c1.4 0 2.2-1.6 1.4-2.7l-1.3-2.1c-.4-.6-.7-1.6-.7-2.3V8.7c0-3.4-2.7-6.2-6-6.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
