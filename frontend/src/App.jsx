import { useState } from 'react';
import NotificationBell from './components/NotificationBell';
import './App.css';

// Demo identities matching the seeded data, so you can flip between them in
// the UI and see tenant isolation working live. In a real app this would come
// from your actual logged-in session, not a dropdown.
const IDENTITIES = [
  { label: 'Tenant t1 — user u1 (Nova Talent)', tenantId: 't1', userId: 'u1' },
  { label: 'Tenant t1 — a different user', tenantId: 't1', userId: 'u2' },
  { label: 'Tenant t2 — user (Bright Star Agency)', tenantId: 't2', userId: 'u3' },
];

export default function App() {
  const [identityIndex, setIdentityIndex] = useState(0);
  const identity = IDENTITIES[identityIndex];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Nova CRM
        </div>

        <div className="header-right">
          <label className="identity-switcher">
            <span>Viewing as</span>
            <select
              value={identityIndex}
              onChange={(e) => setIdentityIndex(Number(e.target.value))}
            >
              {IDENTITIES.map((id, i) => (
                <option key={id.label} value={i}>
                  {id.label}
                </option>
              ))}
            </select>
          </label>

          <NotificationBell key={identity.tenantId + identity.userId} tenantId={identity.tenantId} userId={identity.userId} />
        </div>
      </header>

      <main className="app-main">
        <h1>What happened while you weren't looking</h1>
        <p className="app-sub">
          This is a minimal demo screen — the bell in the header is the whole feature.
          Switch identities above to see tenant isolation in action, or fire a trigger
          below and watch the badge update on the next poll (or reopen the panel).
        </p>

        <TriggerPanel identity={identity} />
      </main>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function TriggerPanel({ identity }) {
  const [status, setStatus] = useState(null);

  async function fire(path, body) {
    setStatus('Sending…');
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setStatus(`Fired: ${data.notification.title} → ${data.notification.userId ?? 'everyone in tenant'}`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  return (
    <section className="trigger-panel">
      <h2>Fire a demo event</h2>
      <div className="trigger-buttons">
        <button
          onClick={() =>
            fire('/webhooks/member-invited', {
              tenantId: identity.tenantId,
              memberName: 'A new teammate',
            })
          }
        >
          Simulate: teammate invited (tenant-wide)
        </button>
        <button
          onClick={() =>
            fire('/webhooks/creator-replied', {
              tenantId: identity.tenantId,
              userId: identity.userId,
              creatorName: 'A creator',
            })
          }
        >
          Simulate: creator replied (just for you)
        </button>
      </div>
      {status && <p className="trigger-status">{status}</p>}
    </section>
  );
}
