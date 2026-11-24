import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { followUpLabel } from '../format';

function Icon({ name }) {
  const paths = {
    desk: 'M4 5h16v11H4zM8 20h8M12 16v4',
    projects: 'M6 4h8l4 4v12H6zM14 4v4h4M8 12h8M8 16h5',
    leads: 'M8 3h8a2 2 0 0 1 2 2v2H6V5a2 2 0 0 1 2-2zM6 7h12v3a6 6 0 0 1-12 0zM9 19h6',
    servers: 'M4 6h16v4H4zM4 14h16v4H4zM7 8h.01M7 16h.01',
    timeline: 'M5 4v16M5 8h9M5 13h13M5 18h7',
    payments: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
    auto: 'M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1L7 17M17 7l2.1-2.1',
    account: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20a7 7 0 0 1 14 0',
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

function CallBanner({ calls, onSnooze }) {
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  if (!calls.length) return null;
  const first = calls[0];

  async function allow() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  return (
    <section className="call-banner">
      <div>
        <p className="kicker on-dark">Call now</p>
        <strong>{first.clientName}</strong>
        <p>{first.note}</p>
        <p className="call-when">{followUpLabel(first.followUpAt)}{first.callerName ? ` · ${first.callerName}` : ''}</p>
        {calls.length > 1 && <p>{calls.length - 1} more call{calls.length === 2 ? '' : 's'} waiting</p>}
      </div>
      <div className="call-actions">
        <Link className="btn gold" to="/leads">Open leads</Link>
        <button type="button" className="btn secondary" onClick={() => onSnooze(first.id)}>Remind in an hour</button>
        {permission === 'default' && (
          <button type="button" className="btn secondary" onClick={allow}>Allow alerts</button>
        )}
      </div>
    </section>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [attention, setAttention] = useState(0);
  const [serverOpen, setServerOpen] = useState(0);
  const [dueCalls, setDueCalls] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let ignore = false;
    function loadCalls() {
      api('/api/leads/reminders')
        .then((rows) => { if (!ignore) setDueCalls(rows); })
        .catch(() => {});
    }
    api('/api/projects/overview')
      .then((overview) => {
        if (ignore) return;
        const urgent = overview.renewals.filter((project) => project.daysUntilDue <= 7).length;
        setAttention(urgent + overview.unpaid.length);
        setServerOpen(overview.serverMonth?.openCount || 0);
      })
      .catch(() => {});
    loadCalls();
    const timer = setInterval(loadCalls, 20000);
    window.addEventListener('gypsy-leads', loadCalls);
    return () => {
      ignore = true;
      clearInterval(timer);
      window.removeEventListener('gypsy-leads', loadCalls);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const seen = JSON.parse(sessionStorage.getItem('gypsy-reminded') || '[]');
    let changed = false;
    for (const lead of dueCalls) {
      const key = `${lead.id}@${lead.followUpAt}`;
      if (seen.includes(key)) continue;
      seen.push(key);
      changed = true;
      const note = lead.note ? lead.note.slice(0, 140) : 'They asked you to call back.';
      new Notification(`Contact ${lead.clientName}`, { body: note });
    }
    if (changed) sessionStorage.setItem('gypsy-reminded', JSON.stringify(seen.slice(-80)));
  }, [dueCalls]);

  async function snooze(id) {
    await api(`/api/leads/${id}/snooze`, { method: 'POST', body: { minutes: 60 } });
    const rows = await api('/api/leads/reminders');
    setDueCalls(rows);
  }

  const initial = (user?.name || 'G').slice(0, 1).toUpperCase();

  return (
    <div className={`shell${menuOpen ? ' menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">G</span>
          <div>
            <p className="brand-kicker">Gypsy Coder</p>
            <strong>Gypsy Desk</strong>
          </div>
        </div>
        <button
          type="button"
          className="menu-btn"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="side-panel">
        <nav className="nav">
          <p className="nav-label">Work</p>
          <NavLink to="/" end><Icon name="desk" /> Desk</NavLink>
          <NavLink to="/leads">
            <Icon name="leads" /> Leads
            {dueCalls.length > 0 && <span className="badge">{dueCalls.length}</span>}
          </NavLink>
          <NavLink to="/projects"><Icon name="projects" /> Projects</NavLink>
          <p className="nav-label">Money</p>
          <NavLink to="/payments"><Icon name="payments" /> Payments</NavLink>
          <NavLink to="/servers">
            <Icon name="servers" /> Server log
            {serverOpen > 0 && <span className="badge">{serverOpen}</span>}
          </NavLink>
          <NavLink to="/timeline"><Icon name="timeline" /> Timeline</NavLink>
          <NavLink to="/automation">
            <Icon name="auto" /> Automation
            {attention > 0 && <span className="badge">{attention}</span>}
          </NavLink>
          <p className="nav-label">Studio</p>
          <NavLink to="/account"><Icon name="account" /> Account</NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <span className="avatar">{initial}</span>
            <div>
              <strong>{user?.name}</strong>
              <p>{user?.email}</p>
            </div>
          </div>
          <button type="button" className="btn secondary light" onClick={logout}>Sign out</button>
        </div>
        </div>
      </aside>
      {menuOpen && (
        <button type="button" className="menu-shade" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
      )}
      <main className="main">
        <CallBanner calls={dueCalls} onSnooze={snooze} />
        <Outlet />
      </main>
    </div>
  );
}
