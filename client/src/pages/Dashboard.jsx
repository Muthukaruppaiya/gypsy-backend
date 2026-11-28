import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ago, dueLabel, dueTone, followUpLabel, inr, phoneLinks, todayLabel } from '../format';
import { clock, dayLabel } from '../leadTime';
import { Empty, Icon, Loading, statusKey, usePageTitle } from '../components/ui';

const PREVIEW = 5;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function pct(part, whole) {
  return whole ? Math.min(100, Math.round((part / whole) * 100)) : 0;
}

function Meter({ value, label, dark }) {
  return (
    <div
      className={`meter${dark ? ' on-dark' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

/* ---------- Today: one list of everything that needs action ---------- */

function buildAgenda({ data, leads, userId, isAdmin }) {
  const now = Date.now();
  const items = [];
  const mine = leads
    .filter((lead) => lead.status === 'Open' && (lead.calledBy === userId || lead.calledBy == null))
    .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));
  const due = mine.filter((lead) => new Date(lead.followUpAt).getTime() <= now);

  for (const lead of due.slice(0, 3)) {
    items.push({
      key: `call-${lead.id}`,
      tone: 'urgent',
      icon: 'phone',
      title: `Call ${lead.clientName}`,
      sub: `${followUpLabel(lead.followUpAt).split(' · ')[0]}${lead.note ? ` · ${lead.note}` : ''}`,
      phone: lead.phone,
      to: '/leads/due',
      action: 'Open',
    });
  }
  if (due.length > 3) {
    items.push({
      key: 'more-calls', tone: 'urgent', icon: 'leads',
      title: `${due.length - 3} more call${due.length - 3 === 1 ? '' : 's'} due`,
      sub: 'Oldest first on the follow-ups page', to: '/leads/due', action: 'See all',
    });
  }

  if (isAdmin) {
    for (const project of data.renewals.filter((item) => item.daysUntilDue <= 3).slice(0, 3)) {
      items.push({
        key: `renew-${project.id}`,
        tone: project.daysUntilDue <= 1 ? 'urgent' : 'soon',
        icon: 'servers',
        title: `Server renewal · ${project.clientName}`,
        sub: dueLabel(project.daysUntilDue, project.nextDueDate),
        to: `/projects/${project.id}`,
        action: 'Open',
      });
    }
    const month = data.serverMonth || {};
    if (month.openCount > 0) {
      items.push({
        key: 'hosting', tone: 'soon', icon: 'money',
        title: `${month.openCount} client${month.openCount === 1 ? '' : 's'} not logged for ${month.label} hosting`,
        sub: `${inr(month.collected || 0)} of ${inr(month.expected || 0)} collected so far`,
        to: '/servers', action: 'Open log',
      });
    }
    if (data.gaps.length > 0) {
      items.push({
        key: 'gaps', tone: 'quiet', icon: 'wrench',
        title: `${data.gaps.length} project${data.gaps.length === 1 ? ' is' : 's are'} missing server details`,
        sub: data.gaps.slice(0, 3).map((project) => project.clientName).join(', '),
        to: '/automation', action: 'Review',
      });
    }
  }

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const laterToday = mine.filter((lead) => {
    const when = new Date(lead.followUpAt).getTime();
    return when > now && when <= endOfDay.getTime();
  });
  for (const lead of laterToday.slice(0, 3)) {
    items.push({
      key: `today-${lead.id}`, tone: 'quiet', icon: 'clock',
      title: `${clock(lead.followUpAt)} · ${lead.clientName}`,
      sub: lead.note || 'Call back later today',
      phone: lead.phone,
      to: '/leads/later', action: 'Open',
    });
  }
  return { items, dueCount: due.length };
}

function TodayCard({ agenda, hasLeads }) {
  const { items } = agenda;
  const urgent = items.filter((item) => item.tone === 'urgent').length;
  return (
    <article className="card today-card">
      <div className="card-head">
        <h2>Today</h2>
        {items.length > 0 && <span className={`count-pill${urgent ? ' hot' : ''}`}>{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <div className="all-clear">
          <span className="all-clear-icon"><Icon name="check" /></span>
          <div>
            <strong>All clear</strong>
            <p className="muted">{hasLeads ? 'No calls due and nothing urgent. Good time to log new calls.' : 'Start by logging your first call or adding a project.'}</p>
          </div>
        </div>
      ) : (
        <ul className="agenda">
          {items.map((item) => {
            const links = phoneLinks(item.phone);
            return (
              <li key={item.key} className={`agenda-item tone-${item.tone}`}>
                <span className="agenda-icon"><Icon name={item.icon} /></span>
                <div className="agenda-text">
                  <strong>{item.title}</strong>
                  {item.sub && <p>{item.sub}</p>}
                </div>
                <div className="agenda-actions">
                  {links && (
                    <>
                      <a className="icon-btn call" href={links.tel} aria-label={`Phone ${item.title.replace(/^Call /, '')}`}><Icon name="phone" /></a>
                      <a className="icon-btn wa" href={links.wa} target="_blank" rel="noreferrer" aria-label="Message on WhatsApp"><Icon name="chat" /></a>
                    </>
                  )}
                  <Link className="mini-action" to={item.to}>{item.action}</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

/* ---------- Money ---------- */

function MoneyCard({ data, isAdmin }) {
  const collectedPct = pct(data.money.collected, data.money.contracted);
  const month = data.serverMonth || {};
  const hostingPct = pct(month.collected || 0, month.expected || 0);
  return (
    <aside className="money-card">
      <div className="money-top">
        <div>
          <p className="kicker on-dark">To collect</p>
          <p className="money-figure">{inr(data.money.outstanding)}</p>
        </div>
        <span className="money-pct" aria-label={`${collectedPct}% collected`}>{collectedPct}%</span>
      </div>
      <Meter value={collectedPct} label="Software money collected" dark />
      <p className="money-row">{inr(data.money.collected)} of {inr(data.money.contracted)} collected</p>

      {isAdmin ? (
        month.expected ? (
          <Link className="money-line" to="/servers">
            <span className="money-line-label">{month.label} hosting</span>
            <span className="mini-meter dark" aria-hidden="true"><span style={{ width: `${hostingPct}%` }} /></span>
            <span className={month.openCount ? 'warn-on-dark' : 'ok-on-dark'}>
              {month.openCount ? `${month.openCount} to log` : 'All logged'}
            </span>
          </Link>
        ) : (
          <Link className="money-line" to="/projects">
            <span className="money-line-label">Hosting not set up</span>
            <span className="money-line-cta">Set rates →</span>
          </Link>
        )
      ) : (
        <div className="money-facts">
          <div><span>Won from calls</span><strong>{data.calls?.converted ?? 0}</strong></div>
          <div><span>Projects</span><strong>{data.counts.total}</strong></div>
        </div>
      )}
    </aside>
  );
}

/* ---------- Cards ---------- */

function PipelineStats({ counts, calls }) {
  return (
    <section className="kpi-row">
      <Link className="kpi talk" to="/projects?status=Under%20Discussion">
        <span>In talks</span><strong>{counts.underDiscussion}</strong>
      </Link>
      <Link className="kpi dev" to="/projects?status=Under%20Development">
        <span>Building</span><strong>{counts.underDevelopment}</strong>
      </Link>
      <Link className="kpi live" to="/projects?status=Live">
        <span>Live</span><strong>{counts.live}</strong>
      </Link>
      <Link className={`kpi calls${calls?.due ? ' hot' : ''}`} to="/leads/due?who=all">
        <span>Calls due</span><strong>{calls?.due ?? 0}</strong>
        <small>{calls?.later ?? 0} later · {calls?.converted ?? 0} won</small>
      </Link>
    </section>
  );
}

function UnpaidCard({ unpaid, isAdmin }) {
  const rows = unpaid.slice(0, PREVIEW);
  return (
    <article className="card">
      <div className="card-head">
        <h2>Open balances</h2>
        <Link to={isAdmin ? '/payments' : '/projects'}>{isAdmin ? 'Payments' : 'Projects'} →</Link>
      </div>
      {rows.length === 0 ? (
        <Empty>Every software budget is paid in full.</Empty>
      ) : (
        <ul className="list">
          {rows.map((project) => {
            const paid = pct(project.received || 0, project.payment || 0);
            return (
              <li key={project.id}>
                <span className="list-main">
                  <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                  <span className="mini-meter" aria-hidden="true"><span style={{ width: `${paid}%` }} /></span>
                  <small className="muted">{paid}% paid · {project.leadBy || 'No lead'}</small>
                </span>
                <span className="list-end">
                  <span className="money-due">{inr(project.balance)}</span>
                  {isAdmin && <Link className="mini-action" to={`/payments?project=${project.id}`}>Log</Link>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {unpaid.length > PREVIEW && (
        <Link className="more-link" to={isAdmin ? '/payments' : '/projects'}>{unpaid.length - PREVIEW} more</Link>
      )}
    </article>
  );
}

function UpcomingCalls({ leads, userId }) {
  const now = Date.now();
  const next = leads
    .filter((lead) => lead.status === 'Open' && (lead.calledBy === userId || lead.calledBy == null))
    .filter((lead) => new Date(lead.followUpAt).getTime() > now)
    .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt))
    .slice(0, PREVIEW);
  return (
    <article className="card">
      <div className="card-head">
        <h2>Coming up</h2>
        <Link to="/leads/later">Follow-ups →</Link>
      </div>
      {next.length === 0 ? (
        <Empty action={<Link className="btn small" to="/leads/new">Log a call</Link>}>No calls scheduled after today.</Empty>
      ) : (
        <ul className="list">
          {next.map((lead) => (
            <li key={lead.id}>
              <span className="list-main">
                <Link to={`/leads/${lead.id}/edit`}>{lead.clientName}</Link>
                <small className="muted clamp-1">{lead.note}</small>
              </span>
              <span className="tone tone-quiet nowrap">{dayLabel(lead.followUpAt)} · {clock(lead.followUpAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function RenewalsCard({ renewals }) {
  const rows = renewals.slice(0, PREVIEW);
  return (
    <article className="card">
      <div className="card-head">
        <h2>Server renewals</h2>
        <Link to="/timeline">Timeline →</Link>
      </div>
      {rows.length === 0 ? (
        <Empty>No renewal days set. Add a server due day on a project to track it here.</Empty>
      ) : (
        <ul className="list">
          {rows.map((project) => (
            <li key={project.id}>
              <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
              <span className={`tone tone-${dueTone(project.daysUntilDue)} nowrap`}>{dueLabel(project.daysUntilDue, project.nextDueDate)}</span>
            </li>
          ))}
        </ul>
      )}
      {renewals.length > PREVIEW && <Link className="more-link" to="/timeline">{renewals.length - PREVIEW} more on the timeline</Link>}
    </article>
  );
}

function RecentCard({ projects }) {
  const rows = [...projects]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, PREVIEW);
  return (
    <article className="card">
      <div className="card-head">
        <h2>Recently updated</h2>
        <Link to="/projects">All projects →</Link>
      </div>
      {rows.length === 0 ? (
        <Empty action={<Link className="btn small" to="/projects/new">Add a project</Link>}>No projects yet.</Empty>
      ) : (
        <ul className="list">
          {rows.map((project) => (
            <li key={project.id}>
              <span className="list-main">
                <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                <small className="muted">{project.leadBy || 'No lead'} · updated {ago(project.updatedAt)}</small>
              </span>
              <span className={`pill pill-${statusKey(project.status)}`}>{project.status === 'Under Development' ? 'Building' : project.status === 'Under Discussion' ? 'In talks' : 'Live'}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ByLead({ data }) {
  if (!data.leads.length) return null;
  const max = Math.max(...data.leads.map((lead) => lead.projects), 1);
  return (
    <article className="card">
      <div className="card-head">
        <h2>By lead</h2>
        <span className="muted tiny">{data.counts.total} project{data.counts.total === 1 ? '' : 's'}</span>
      </div>
      <ul className="lead-bars">
        {data.leads.map((lead) => (
          <li key={lead.lead}>
            {lead.lead === 'Unassigned'
              ? <span className="muted">Unassigned</span>
              : <Link to={`/projects?lead=${encodeURIComponent(lead.lead)}`}>{lead.lead}</Link>}
            <span className="bar" aria-hidden="true"><span style={{ width: `${pct(lead.projects, max)}%` }} /></span>
            <span className="bar-num">{lead.projects}</span>
            <span className={lead.outstanding ? 'money-due' : 'money-clear'}>{lead.outstanding ? inr(lead.outstanding) : 'Clear'}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function QuickActions({ isAdmin }) {
  const actions = [
    { to: '/leads/new', icon: 'phone', label: 'Log a call', primary: true },
    { to: '/projects/new', icon: 'plus', label: 'New project' },
    isAdmin
      ? { to: '/payments', icon: 'money', label: 'Log payment' }
      : { to: '/leads/due', icon: 'leads', label: 'Follow-ups' },
    isAdmin
      ? { to: '/servers', icon: 'servers', label: 'Hosting log' }
      : { to: '/projects', icon: 'projects', label: 'Projects' },
  ];
  return (
    <nav className="quick-actions" aria-label="Quick actions">
      {actions.map((action) => (
        <Link key={action.to} to={action.to} className={`quick${action.primary ? ' primary' : ''}`}>
          <span className="quick-icon"><Icon name={action.icon} /></span>
          <span>{action.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default function Dashboard() {
  usePageTitle('Desk');
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    function load() {
      api('/api/projects/overview').then(setData).catch((err) => setError(err.message));
      api('/api/leads').then((result) => setLeads(result.leads || [])).catch(() => {});
      api('/api/projects').then(setProjects).catch(() => {});
    }
    load();
    // Keep "Today" honest: re-check every minute and when leads change elsewhere.
    const timer = setInterval(() => setTick((value) => value + 1), 60000);
    const refresh = setInterval(load, 5 * 60000);
    window.addEventListener('gypsy-leads', load);
    return () => {
      clearInterval(timer);
      clearInterval(refresh);
      window.removeEventListener('gypsy-leads', load);
    };
  }, []);

  if (error) return <p className="banner">{error}</p>;
  if (!data) return <Loading label="Loading the book…" />;

  const admin = isAdmin && data.role === 'admin';
  const agenda = buildAgenda({ data, leads, userId: user.id, isAdmin: admin });
  const first = (user.name || '').split(' ')[0];
  const urgent = agenda.items.filter((item) => item.tone === 'urgent').length;
  const summary = urgent
    ? `${urgent} thing${urgent === 1 ? '' : 's'} need${urgent === 1 ? 's' : ''} you now.`
    : agenda.items.length
      ? 'Nothing urgent. A few things to keep an eye on.'
      : 'Nothing needs you right now.';

  return (
    <div className="page desk">
      <header className="desk-head">
        <div>
          <p className="kicker">{todayLabel()}</p>
          <h1>{greeting()}, {first}</h1>
          <p className={`desk-summary${urgent ? ' hot' : ''}`}>{summary}</p>
        </div>
        <QuickActions isAdmin={admin} />
      </header>

      <section className="desk-grid">
        <TodayCard agenda={agenda} hasLeads={leads.length > 0} />
        <MoneyCard data={data} isAdmin={admin} />
      </section>

      <PipelineStats counts={data.counts} calls={data.calls} />

      <section className="split">
        <UnpaidCard unpaid={data.unpaid} isAdmin={admin} />
        <UpcomingCalls leads={leads} userId={user.id} />
      </section>

      <section className="split">
        {admin ? <RenewalsCard renewals={data.renewals} /> : <ByLead data={data} />}
        <RecentCard projects={projects} />
      </section>

      {admin && <ByLead data={data} />}
    </div>
  );
}
