import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { dueLabel, dueTone, inr } from '../format';

export default function Timeline() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/servers/timeline').then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Timeline</h1>
        </div>
      </header>

      {error && <p className="banner">{error}</p>}
      {!data && !error && <p className="kicker">Drawing the line…</p>}

      {data && (
        <>
          <div className="time-now">Today · {data.today}</div>
          <div className="timeline">
            {data.scheduled.map((project) => (
              <article key={project.id} className="time-item">
                <div className="time-when">
                  <strong className={`tone tone-${dueTone(project.daysUntilDue)}`}>
                    {dueLabel(project.daysUntilDue, project.nextDueDate)}
                  </strong>
                  <span>Day {project.serverDueDay}</span>
                </div>
                <span className={`time-dot tone-dot-${dueTone(project.daysUntilDue)}`} />
                <div className="time-card">
                  <h2><Link to={`/projects/${project.id}`}>{project.clientName}</Link></h2>
                  <p>{project.serverName}{project.url ? ` · ${project.url}` : ''}</p>
                  {project.monthlyServerCost != null && (
                    <p className="muted">Monthly hosting {inr(project.monthlyServerCost)}</p>
                  )}
                </div>
              </article>
            ))}
          </div>

          {data.unscheduled.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>No deadline yet</h2>
              </div>
              <ul className="list">
                {data.unscheduled.map((project) => (
                  <li key={project.id}>
                    <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                    <span className="muted">{project.serverName}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
