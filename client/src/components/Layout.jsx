import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { followUpLabel, phoneLinks } from '../format';
import { BrandMark, Icon, useToast } from './ui';
import QuickSearch from './QuickSearch';

function CallBanner({ calls, onSnooze, onLeads }) {
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  if (!calls.length) return null;
  const first = calls[0];
  const links = phoneLinks(first.phone);

  async function allow() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  return (
    <section className="call-banner" aria-label="Calls due">
      <div className="call-text">
        <p className="kicker on-dark">Call now{calls.length > 1 ? ` · ${calls.length} waiting` : ''}</p>
        <strong>{first.clientName}</strong>
        {first.note && <p className="call-note">{first.note}</p>}
        <p className="call-when">{followUpLabel(first.followUpAt).split(' · ')[0]}{first.callerName ? ` · ${first.callerName}` : ''}</p>
      </div>
      <div className="call-actions">
        {links && <a className="btn gold" href={links.tel}><Icon name="phone" /> Call</a>}
        {links && <a className="btn secondary" href={links.wa} target="_blank" rel="noreferrer">WhatsApp</a>}
        {!onLeads && <Link className={`btn ${links ? 'secondary' : 'gold'}`} to="/leads/due">Open</Link>}
        <button type="button" className="btn secondary" onClick={() => onSnooze(first.id)}>+1 hour</button>
        {permission === 'default' && (
          <button type="button" className="btn secondary" onClick={allow}>Allow alerts</button>
        )}
      </div>
    </section>
  );
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [attention, setAttention] = useState(0);
  const [serverOpen, setServerOpen] = useState(0);
  const [dueCalls, setDueCalls] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const notify = useToast();

  useEffect(() => {
    function onKey(event) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === '/' && !typing) {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === 'Escape') {
        setAddOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setAddOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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
        if (overview.role !== 'admin') return;
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
    try {
      await api(`/api/leads/${id}/snooze`, { method: 'POST', body: { minutes: 60 } });
      const rows = await api('/api/leads/reminders');
      setDueCalls(rows);
      window.dispatchEvent(new Event('gypsy-leads'));
      notify('We will remind you again in an hour.');
    } catch (err) {
      notify(err.message, { tone: 'error' });
    }
  }

  const initial = (user?.name || 'G').slice(0, 1).toUpperCase();

  return (
    <div className={`shell${menuOpen ? ' menu-open' : ''}`}>
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="Gypsy Desk home">
          <BrandMark size={42} />
          <div>
            <p className="brand-kicker">Gypsy Coder</p>
            <strong>Gypsy Desk</strong>
          </div>
        </Link>
        <button type="button" className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search">
          <Icon name="search" />
          <span className="search-trigger-label">Search</span>
          <kbd>Ctrl K</kbd>
        </button>
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
        <Link className="btn gold nav-cta" to="/leads/new"><Icon name="phone" /> Log a call</Link>
        <nav className="nav">
          <p className="nav-label">Work</p>
          <NavLink to="/" end><Icon name="desk" /> Desk</NavLink>
          <NavLink to="/leads/due" className={() => (location.pathname.startsWith('/leads') && location.pathname !== '/leads/new' ? 'active' : '')}>
            <Icon name="leads" /> Follow-ups
            {dueCalls.length > 0 && <span className="badge">{dueCalls.length}</span>}
          </NavLink>
          <NavLink to="/projects"><Icon name="projects" /> Projects</NavLink>
          {isAdmin && (
            <>
              <p className="nav-label">Money &amp; servers</p>
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
            </>
          )}
          <p className="nav-label">Studio</p>
          {isAdmin && <NavLink to="/team"><Icon name="team" /> Team</NavLink>}
          <NavLink to="/account"><Icon name="account" /> Account</NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <span className="avatar">{initial}</span>
            <div>
              <strong>{user?.name}</strong>
              <p><span className={`role-badge role-${user?.role}`}>{isAdmin ? 'Admin' : 'Sales'}</span></p>
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
        {location.pathname !== '/' && (
          <CallBanner calls={dueCalls} onSnooze={snooze} onLeads={location.pathname.startsWith('/leads/due')} />
        )}
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Main">
        <NavLink to="/" end><Icon name="desk" /><span>Desk</span></NavLink>
        <NavLink to="/leads/due" className={() => (location.pathname.startsWith('/leads') && location.pathname !== '/leads/new' ? 'active' : '')}>
          <Icon name="leads" /><span>Follow-ups</span>
          {dueCalls.length > 0 && <b className="dot-badge">{dueCalls.length}</b>}
        </NavLink>
        <button type="button" className="bottom-add" aria-label="Add" aria-expanded={addOpen} onClick={() => setAddOpen((value) => !value)}>
          <Icon name={addOpen ? 'close' : 'plus'} />
        </button>
        <NavLink to="/projects"><Icon name="projects" /><span>Projects</span></NavLink>
        <button type="button" className={menuOpen ? 'active' : ''} onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
          <Icon name="menu" /><span>More</span>
        </button>
      </nav>

      {addOpen && (
        <div className="sheet-back" onClick={() => setAddOpen(false)}>
          <div className="sheet" role="dialog" aria-label="Add something" onClick={(event) => event.stopPropagation()}>
            <p className="kicker">Add</p>
            <Link className="sheet-item" to="/leads/new"><Icon name="phone" /><span><strong>Log a call</strong><small>Note what a client said and set a reminder</small></span></Link>
            <Link className="sheet-item" to="/projects/new"><Icon name="projects" /><span><strong>New project</strong><small>Add a client to the book</small></span></Link>
            {isAdmin && <Link className="sheet-item" to="/payments"><Icon name="money" /><span><strong>Log a payment</strong><small>Money received for software</small></span></Link>}
            {isAdmin && <Link className="sheet-item" to="/servers"><Icon name="servers" /><span><strong>Log hosting</strong><small>This month's server collection</small></span></Link>}
          </div>
        </div>
      )}

      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} isAdmin={isAdmin} />
    </div>
  );
}
