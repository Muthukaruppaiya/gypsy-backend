import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, downloadCsv } from '../api';
import { useAuth } from '../auth';
import { dueLabel, dueTone, inr, STATUSES, urlLinks } from '../format';
import { Empty, Icon, Loading, PageHead, statusKey, useToast, usePageTitle } from '../components/ui';

export default function Projects() {
  usePageTitle('Projects');
  const navigate = useNavigate();
  const notify = useToast();
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const status = params.get('status') || '';
  const lead = params.get('lead') || '';
  const q = params.get('q') || '';

  useEffect(() => {
    api('/api/projects').then(setProjects).catch((err) => setError(err.message));
  }, []);

  const leads = useMemo(
    () => [...new Set((projects || []).map((project) => project.leadBy).filter(Boolean))].sort(),
    [projects],
  );

  const counts = useMemo(() => {
    const map = { '': (projects || []).length };
    for (const name of STATUSES) map[name] = (projects || []).filter((project) => project.status === name).length;
    return map;
  }, [projects]);

  function setFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === 'q' });
  }

  function clearFilters() {
    setParams(new URLSearchParams());
  }

  const filtered = (projects || []).filter((project) => {
    if (status && project.status !== status) return false;
    if (lead && project.leadBy !== lead) return false;
    if (q) {
      const blob = [project.clientName, project.leadBy, project.serverName, project.ip, project.url, project.serverOs, project.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!blob.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const hasFilters = Boolean(status || lead || q);

  async function onExport() {
    setExporting(true);
    try {
      await downloadCsv();
      notify('Sheet exported. It contains server passwords, so keep it private.', { tone: 'warn', timeout: 6000 });
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  const totalOpen = filtered.reduce((sum, project) => sum + (project.balance || 0), 0);
  const groups = STATUSES
    .filter((name) => !status || status === name)
    .map((name) => ({ name, rows: filtered.filter((project) => project.status === name) }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className="page projects-page">
      <PageHead
        title="Projects"
        summary={projects ? (
          <>
            {hasFilters ? `${filtered.length} of ${projects.length}` : projects.length} project{(hasFilters ? filtered.length : projects.length) === 1 ? '' : 's'}
            {totalOpen > 0 && <> · <span className="money-due">{inr(totalOpen)}</span> open</>}
          </>
        ) : null}
      >
          {isAdmin && (
            <button type="button" className="btn secondary" onClick={onExport} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          )}
          <Link className="btn" to="/projects/new"><Icon name="plus" /> New project</Link>
      </PageHead>

      <div className="project-filters">
        <label className="search-box-inline">
          <Icon name="search" />
          <span className="sr">Search projects</span>
          <input
            type="search"
            placeholder={isAdmin ? 'Search client, server, IP or URL' : 'Search client, lead or notes'}
            value={q}
            onChange={(event) => setFilter('q', event.target.value)}
          />
        </label>
        <div className="filter-row">
          <div className="chips chip-scroll" role="group" aria-label="Status">
            <button type="button" className={status === '' ? 'chip on' : 'chip'} aria-pressed={status === ''} onClick={() => setFilter('status', '')}>
              All <span className="chip-count">{counts['']}</span>
            </button>
            {STATUSES.map((item) => (
              <button
                key={item}
                type="button"
                className={status === item ? 'chip on' : 'chip'}
                aria-pressed={status === item}
                onClick={() => setFilter('status', item)}
              >
                <span className={`dot dot-${statusKey(item)}`} aria-hidden="true" />
                {SHORT[item]} <span className="chip-count">{counts[item] ?? 0}</span>
              </button>
            ))}
          </div>
          <label className="lead-select">
            <span className="sr">Lead</span>
            <select value={lead} onChange={(event) => setFilter('lead', event.target.value)}>
              <option value="">All leads</option>
              {leads.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {hasFilters && (
            <button type="button" className="text-btn clear-btn" onClick={clearFilters}>Clear</button>
          )}
        </div>
      </div>

      {error && <p className="banner">{error}</p>}
      {!projects && !error && <Loading label="Loading the book…" />}

      {projects && projects.length === 0 && (
        <Empty action={<Link className="btn" to="/projects/new">Add your first project</Link>}>
          The book is empty.
        </Empty>
      )}

      {projects && projects.length > 0 && filtered.length === 0 && (
        <Empty action={<button type="button" className="btn secondary" onClick={clearFilters}>Clear filters</button>}>
          No projects match {q ? <>“{q}”</> : 'these filters'}.
        </Empty>
      )}

      {groups.map(({ name, rows }) => {
        const open = rows.reduce((sum, project) => sum + (project.balance || 0), 0);
        return (
          <section className="group" key={name}>
            <div className="group-head">
              <h2><span className={`dot dot-lg dot-${statusKey(name)}`} aria-hidden="true" />{name}</h2>
              <p>
                {rows.length}
                {open > 0 && <> · <span className="money-due">{inr(open)}</span> open</>}
              </p>
            </div>

            <div className="table-wrap card desktop-only">
              <table className="project-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Lead</th>
                    {isAdmin && <th>Server</th>}
                    <th>Budget</th>
                    <th>Paid</th>
                    <th>Open</th>
                    {isAdmin && <th>Renewal</th>}
                    <th>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((project) => (
                    <tr
                      key={project.id}
                      className={`row-link status-${statusKey(name)}`}
                      onClick={(event) => {
                        if (event.target.closest('a, button')) return;
                        navigate(`/projects/${project.id}`);
                      }}
                    >
                      <td><Link className="client-link" to={`/projects/${project.id}`}>{project.clientName}</Link></td>
                      <td>{project.leadBy || <span className="muted">—</span>}</td>
                      {isAdmin && (
                        <td>
                          <div>{project.serverName || <span className="muted">—</span>}</div>
                          <div className="muted tiny">
                            {[project.serverOs, project.monthlyServerCost ? `${inr(project.monthlyServerCost)} / mo` : ''].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                      )}
                      <td>{inr(project.payment)}</td>
                      <td>
                        {project.payment ? (
                          <div className="paid-cell">
                            <div className="meter slim"><span style={{ width: `${paidPct(project)}%` }} /></div>
                            <small>{paidPct(project)}%</small>
                          </div>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td>{project.balance ? <span className="money-due">{inr(project.balance)}</span> : project.payment != null ? <span className="money-clear">Clear</span> : <span className="muted">—</span>}</td>
                      {isAdmin && (
                        <td className="due-cell">
                          {project.serverDueDay
                            ? <span className={`tone tone-${dueTone(project.daysUntilDue)}`}>{dueLabel(project.daysUntilDue, project.nextDueDate)}</span>
                            : <span className="muted">—</span>}
                        </td>
                      )}
                      <td className="url-cell">
                        {urlLinks(project.url).length
                          ? urlLinks(project.url).map((link) => (
                            <a key={link.label} href={link.href} target="_blank" rel="noreferrer" title={link.href}>{link.label}</a>
                          ))
                          : <span className="muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="project-cards mobile-only">
              {rows.map((project) => <ProjectCard key={project.id} project={project} isAdmin={isAdmin} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const SHORT = { Live: 'Live', 'Under Development': 'Building', 'Under Discussion': 'In talks' };

function paidPct(project) {
  if (!project.payment) return 0;
  return Math.min(100, Math.round(((project.received || 0) / project.payment) * 100));
}

// Phone layout: one tappable card per project, showing only the fields that have values.
function ProjectCard({ project, isAdmin }) {
  const pct = paidPct(project);
  const link = urlLinks(project.url)[0];
  const meta = [project.leadBy, isAdmin ? project.serverName : null].filter(Boolean);
  return (
    <li className={`project-card status-${statusKey(project.status)}`}>
      <Link className="project-card-link" to={`/projects/${project.id}`} aria-label={`Open ${project.clientName}`} />
      <div className="pc-top">
        <strong className="pc-name">{project.clientName}</strong>
        {project.balance
          ? <span className="money-due">{inr(project.balance)}</span>
          : project.payment != null ? <span className="pill pill-live">Paid</span> : null}
      </div>
      {meta.length > 0 && <p className="pc-meta">{meta.join(' · ')}</p>}
      {project.payment ? (
        <div className="pc-pay">
          <span className="mini-meter wide" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
          <small>{pct}% of {inr(project.payment)}</small>
        </div>
      ) : (
        <p className="pc-meta muted">No budget set</p>
      )}
      {((isAdmin && project.serverDueDay) || link) && (
        <div className="pc-tags">
          {isAdmin && project.serverDueDay && (
            <span className={`pc-tag tone-${dueTone(project.daysUntilDue)}`}><Icon name="servers" />{dueLabel(project.daysUntilDue, project.nextDueDate)}</span>
          )}
          {link && (
            <a className="pc-tag pc-url" href={link.href} target="_blank" rel="noreferrer"><Icon name="arrow" />{link.label}</a>
          )}
        </div>
      )}
    </li>
  );
}
