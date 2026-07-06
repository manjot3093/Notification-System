const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Simplified auth stand-in matching the backend convention: every request
// carries X-Tenant-Id and X-User-Id headers. In a real app these would come
// from your actual auth/session, not hardcoded constants — see App.jsx.
function authHeaders(tenantId, userId) {
  return {
    'X-Tenant-Id': tenantId,
    'X-User-Id': userId,
  };
}

async function request(path, { tenantId, userId, method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(tenantId, userId),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const notificationsApi = {
  list: ({ tenantId, userId, page = 1, pageSize = 20 }) =>
    request(`/notifications?page=${page}&pageSize=${pageSize}`, { tenantId, userId }),

  unreadCount: ({ tenantId, userId }) =>
    request('/notifications/unread-count', { tenantId, userId }),

  markRead: ({ tenantId, userId, id }) =>
    request(`/notifications/${id}/read`, { tenantId, userId, method: 'PATCH' }),

  markAllRead: ({ tenantId, userId }) =>
    request('/notifications/read-all', { tenantId, userId, method: 'PATCH' }),
};
