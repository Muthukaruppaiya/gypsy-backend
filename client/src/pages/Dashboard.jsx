import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { dueLabel, dueTone, inr, todayLabel } from '../format';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/projects/overview').then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="banner">{error}</p>;
  if (!data) return <p className="kicker">Loading the book…</p>;

  const collectedPct = data.money.contracted
    ? Math.round((data.money.collected / data.money.contracted) * 100)
    : 0;

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker on-dark">{todayLabel()}</p>
          <h1>Studio book</h1>
          <p className="hero-figure">{inr(data.money.outstanding)}</p>
          <p className="hero-sub">still open on software · {inr(data.money.collected)} collected of {inr(data.money.contracted)}</p>
          <div className="meter on-dark" aria-hidden="true">
            <span style={{ width: `${collectedPct}%` }} />
          </div>
          <Link className="btn gold" to="/projects/new">New project</Link>
        </div>
        <aside className="hero-panel">
          <p className="kicker on-dark">{data.serverMonth?.label || 'This month'} servers</p>
          <strong>{inr(data.serverMonth?.collected || 0)}</strong>
          {data.serverMonth?.expected ? <p>of {inr(data.serverMonth.expected)}</p> : null}
          {data.serverMonth?.openCount > 0 && (
            <p className="hero-alert">{data.serverMonth.openCount} client{data.serverMonth.openCount === 1 ? '' : 's'} not logged yet</p>
          )}
          <Link className="btn gold" to="/servers">Open the collection log</Link>
        </aside>
      </section>

      <section className="status-row">
        <article className="stat live-stat">
          <p>Live</p>
          <strong>{data.counts.live}</strong>
          <span />
        </article>
        <article className="stat dev-stat">
          <p>Building</p>
          <strong>{data.counts.underDevelopment}</strong>
          <span />
        </article>
        <article className="stat talk-stat">
          <p>In talk</p>
          <strong>{data.counts.underDiscussion}</strong>
          <span />
        </article>
        <article className="stat">
          <p>Projects</p>
          <strong>{data.counts.total}</strong>
          <span />
        </article>
      </section>

      <section className="split">
        <article className="card">
          <div className="card-head">
            <h2>Server renewals</h2>
            <Link to="/timeline">Timeline</Link>
          </div>
          <ul className="list">
            {data.renewals.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                <span className={`tone tone-${dueTone(project.daysUntilDue)}`}>{dueLabel(project.daysUntilDue, project.nextDueDate)}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="card">
          <div className="card-head">
            <h2>Open balances</h2>
            <Link to="/projects">All projects</Link>
          </div>
          <ul className="list">
            {data.unpaid.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                <span className="money-due">{inr(project.balance)}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <article className="card">
        <div className="card-head">
          <h2>By lead</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Projects</th>
                <th>Still open</th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map((lead) => (
                <tr key={lead.lead}>
                  <td>{lead.lead}</td>
                  <td>{lead.projects}</td>
                  <td>{lead.outstanding ? inr(lead.outstanding) : 'Clear'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
