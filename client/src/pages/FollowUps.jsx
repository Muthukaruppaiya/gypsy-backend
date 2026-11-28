import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { followUpLabel, phoneLinks } from '../format';
import { clock, dayLabel } from '../leadTime';
import { ConfirmButton, Empty, Icon, Loading, PageHead, useToast, usePageTitle } from '../components/ui';

const VIEWS = {
  due: { title: 'Due now', empty: 'No calls due. You are all caught up.' },
  later: { title: 'Later', empty: 'Nothing scheduled. Log a call to set a reminder.' },
  closed: { title: 'Closed', empty: 'Closed and converted leads show up here.' },
};

function initials(name) {
  return String(name || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function LeadRow({ lead, now, busy, grouped, onConvert, onSnooze, onStatus, onRemove }) {
  const open = lead.status === 'Open';
  const overdue = open && new Date(lead.followUpAt).getTime() <= now;
  const links = phoneLinks(lead.phone);
  return (
    <article className={`lead-row${overdue ? ' due' : ''}${open ? '' : ' done'}`}>
      <div className="lead-when">
        {open ? (
          <>
            <strong>{clock(lead.followUpAt)}</strong>
            {!grouped && <span>{overdue ? followUpLabel(lead.followUpAt).split(' · ')[0] : dayLabel(lead.followUpAt)}</span>}
          </>
        ) : (
          <span className={`pill ${lead.status === 'Converted' ? 'pill-live' : 'pill-talk'}`}>{lead.status}</span>
        )}
      </div>
      <div className="lead-main">
        <div className="lead-title">
          <h3>{lead.clientName}</h3>
          {links && (
            <span className="contact-links">
              <a className="phone-link" href={links.tel} aria-label={`Call ${lead.clientName}`}><Icon name="phone" />{lead.phone}</a>
              <a className="wa-link" href={links.wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${lead.clientName}`}><Icon name="chat" />WhatsApp</a>
            </span>
          )}
        </div>
        <p className="lead-note">{lead.note}</p>
        <p className="lead-owner">
          <span className="avatar-sm" aria-hidden="true">{initials(lead.callerName)}</span>
          {lead.callerName || 'Unassigned'}
        </p>
      </div>
      <div className="lead-actions">
        {open && (
          <>
            <ConfirmButton className="btn" confirmLabel="Yes, make a project" onConfirm={() => onConvert(lead)} disabled={busy}>
              Make a project
            </ConfirmButton>
            <div className="lead-links">
              {overdue && <button type="button" className="text-btn" onClick={() => onSnooze(lead)}>+1 hour</button>}
              <Link className="text-btn" to={`/leads/${lead.id}/edit`}>Edit</Link>
              <button type="button" className="text-btn" onClick={() => onStatus(lead, 'Closed')}>Close</button>
            </div>
          </>
        )}
        {lead.status === 'Converted' && lead.projectId && (
          <Link className="btn secondary" to={`/projects/${lead.projectId}`}>Open project</Link>
        )}
        {lead.status === 'Closed' && (
          <div className="lead-links">
            <button type="button" className="text-btn" onClick={() => onStatus(lead, 'Open')}>Reopen</button>
            <ConfirmButton confirmLabel="Remove it" onConfirm={() => onRemove(lead)}>Remove</ConfirmButton>
          </div>
        )}
      </div>
    </article>
  );
}

export default function FollowUps() {
  const { view } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const who = params.get('who') || 'mine';
  const q = params.get('q') || '';
  usePageTitle(VIEWS[view] ? `Follow-ups · ${VIEWS[view].title}` : 'Follow-ups');

  function load() {
    return api('/api/leads').then(setData).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    const tick = setInterval(() => setNow(Date.now()), 30000);
    const refresh = setInterval(load, 60000);
    window.addEventListener('gypsy-leads', load);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
      window.removeEventListener('gypsy-leads', load);
    };
  }, []);

  function setParam(key, value, fallback = '') {
    const next = new URLSearchParams(params);
    if (value && value !== fallback) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const buckets = useMemo(() => {
    const all = (data?.leads || []).filter((lead) => {
      if (who === 'mine' && lead.calledBy !== user?.id && lead.calledBy != null) return false;
      if (q) {
        const blob = [lead.clientName, lead.phone, lead.note, lead.callerName].filter(Boolean).join(' ').toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    const due = all
      .filter((lead) => lead.status === 'Open' && new Date(lead.followUpAt).getTime() <= now)
      .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));
    const later = all
      .filter((lead) => lead.status === 'Open' && new Date(lead.followUpAt).getTime() > now)
      .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));
    const closed = all
      .filter((lead) => lead.status !== 'Open')
      .sort((a, b) => new Date(b.followUpAt) - new Date(a.followUpAt));
    return { due, later, closed };
  }, [data, who, q, now, user]);

  if (!VIEWS[view]) return <Navigate to="/leads/due" replace />;

  function changed() {
    window.dispatchEvent(new Event('gypsy-leads'));
  }

  async function run(action, message) {
    setError('');
    try {
      await action();
      if (message) notify(message);
      changed();
    } catch (err) {
      setError(err.message);
    }
  }

  const handlers = {
    now,
    busy,
    onSnooze: (lead) => run(
      () => api(`/api/leads/${lead.id}/snooze`, { method: 'POST', body: { minutes: 60 } }),
      `We will remind you about ${lead.clientName} in an hour.`,
    ),
    onStatus: (lead, status) => run(
      () => api(`/api/leads/${lead.id}`, {
        method: 'PUT',
        body: {
          clientName: lead.clientName,
          phone: lead.phone,
          note: lead.note,
          followUpAt: status === 'Open' && new Date(lead.followUpAt).getTime() < Date.now()
            ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
            : lead.followUpAt,
          calledBy: lead.calledBy,
          status,
        },
      }),
      status === 'Closed' ? `${lead.clientName} closed.` : `${lead.clientName} reopened with a reminder in an hour.`,
    ),
    onRemove: (lead) => run(() => api(`/api/leads/${lead.id}`, { method: 'DELETE' }), `${lead.clientName} removed.`),
    onConvert: async (lead) => {
      setBusy(true);
      setError('');
      try {
        const result = await api(`/api/leads/${lead.id}/convert`, { method: 'POST', body: {} });
        changed();
        notify(`${lead.clientName} is now a project. Add the budget next.`, { timeout: 6000 });
        navigate(`/projects/${result.project.id}`);
      } catch (err) {
        setError(err.message);
        setBusy(false);
      }
    },
  };

  const rows = buckets[view];
  const groups = [];
  if (view === 'later') {
    for (const lead of rows) {
      const label = dayLabel(lead.followUpAt, new Date(now));
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(lead);
      else groups.push({ label, items: [lead] });
    }
  }

  return (
    <div className="page">
      <PageHead
        title="Follow-ups"
        summary={data ? (
          <>
            <span className={buckets.due.length ? 'money-due' : ''}>{buckets.due.length} due now</span>
            {' · '}{buckets.later.length} later
          </>
        ) : null}
      >
        <Link className="btn" to="/leads/new"><Icon name="plus" /> Log a call</Link>
      </PageHead>

      <nav className="tabs" aria-label="Follow-up lists">
        <NavLink to={`/leads/due${params.toString() ? `?${params}` : ''}`} className={({ isActive }) => `tab${isActive ? ' on' : ''}${buckets.due.length ? ' alert' : ''}`}>
          Due now <span className="tab-count">{data ? buckets.due.length : '·'}</span>
        </NavLink>
        <NavLink to={`/leads/later${params.toString() ? `?${params}` : ''}`} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
          Later <span className="tab-count">{data ? buckets.later.length : '·'}</span>
        </NavLink>
        <NavLink to={`/leads/closed${params.toString() ? `?${params}` : ''}`} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
          Closed <span className="tab-count">{data ? buckets.closed.length : '·'}</span>
        </NavLink>
      </nav>

      <div className="filters">
        <div className="segmented small" role="radiogroup" aria-label="Whose leads">
          {[['mine', 'Mine'], ['all', 'Everyone']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={who === value}
              className={`seg${who === value ? ' on' : ''}`}
              onClick={() => setParam('who', value, 'mine')}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="field slim search-field">
          <span className="sr">Search leads</span>
          <input type="search" placeholder="Search name, phone or note" value={q} onChange={(event) => setParam('q', event.target.value)} />
        </label>
      </div>

      {error && <p className="banner">{error}</p>}
      {!data && !error && <Loading label="Opening the call book…" />}

      {data && rows.length === 0 && (
        <Empty action={view !== 'closed' ? <Link className="btn" to="/leads/new">Log a call</Link> : null}>
          {q ? `No leads match “${q}”.` : who === 'mine' && (data.leads || []).length ? `${VIEWS[view].empty} Switch to Everyone to see the team's leads.` : VIEWS[view].empty}
        </Empty>
      )}

      {data && rows.length > 0 && view !== 'later' && (
        <div className="lead-list">
          {rows.map((lead) => <LeadRow key={lead.id} lead={lead} {...handlers} />)}
        </div>
      )}

      {data && view === 'later' && groups.map((group) => (
        <section key={group.label} className="day-group">
          <h2 className="day-head">{group.label}<span>{group.items.length}</span></h2>
          <div className="lead-list">
            {group.items.map((lead) => <LeadRow key={lead.id} lead={lead} grouped {...handlers} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
