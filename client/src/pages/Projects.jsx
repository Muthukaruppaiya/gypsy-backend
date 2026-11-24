import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, downloadCsv } from '../api';
import { dueLabel, inr, STATUSES } from '../format';

const GROUPS = ['Live', 'Under Development', 'Under Discussion'];

export default function Projects() {
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

  function setFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  const filtered = (projects || []).filter((project) => {
    if (status && project.status !== status) return false;
    if (lead && project.leadBy !== lead) return false;
    if (q) {
      const blob = [project.clientName, project.leadBy, project.serverName, project.ip, project.url, project.serverOs]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!blob.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  async function onExport() {
    setExporting(true);
    try {
      await downloadCsv();
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Projects</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="btn secondary" onClick={onExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export sheet'}
          </button>
          <Link className="btn" to="/projects/new">New project</Link>
        </div>
      </header>

      <div className="filters">
        <div className="chips">
          <button type="button" className={status === '' ? 'chip on' : 'chip'} onClick={() => setFilter('status', '')}>All</button>
          {STATUSES.map((item) => (
            <button
              key={item}
              type="button"
              className={status === item ? 'chip on' : 'chip'}
              onClick={() => setFilter('status', item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="field slim">
          <span className="sr">Search</span>
          <input
            placeholder="Search"
            value={q}
            onChange={(event) => setFilter('q', event.target.value)}
          />
        </label>
        <label className="field slim">
          <span className="sr">Lead</span>
          <select value={lead} onChange={(event) => setFilter('lead', event.target.value)}>
            <option value="">All leads</option>
            {leads.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="banner">{error}</p>}
      {!projects && !error && <p className="kicker">Loading the book…</p>}

      {projects && GROUPS.filter((name) => !status || status === name).map((name) => {
        const rows = filtered.filter((project) => project.status === name);
        return (
          <section className="group" key={name}>
            <div className="group-head">
              <h2>{name}</h2>
              <p>{rows.length}</p>
            </div>
            {rows.length === 0 ? null : (
              <div className="table-wrap card">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Client</th>
                      <th>Lead</th>
                      <th>Server</th>
                      <th>Budget</th>
                      <th>Open</th>
                      <th>Due</th>
                      <th>URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((project) => (
                      <tr key={project.id} className={`status-${name === 'Live' ? 'live' : name === 'Under Development' ? 'dev' : 'talk'}`}>
                        <td className="num">{project.id}</td>
                        <td>
                          <Link className="client-link" to={`/projects/${project.id}`}>{project.clientName}</Link>
                        </td>
                        <td>{project.leadBy || '—'}</td>
                        <td>
                          <div>{project.serverName || '—'}</div>
                          <div className="muted tiny">
                            {[project.serverOs, project.monthlyServerCost ? `${inr(project.monthlyServerCost)} / mo` : ''].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td>{inr(project.payment)}</td>
                        <td>{project.balance ? <span className="money-due">{inr(project.balance)}</span> : project.payment != null ? <span className="money-clear">Clear</span> : '—'}</td>
                        <td className="due-cell">{project.serverDueDay ? dueLabel(project.daysUntilDue, project.nextDueDate) : '—'}</td>
                        <td className="url-cell">{project.url || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
