import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { dueLabel, dueTone, inr } from '../format';
import { Empty, Loading, PageHead, usePageTitle } from '../components/ui';

export default function Timeline() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  usePageTitle('Timeline');

  useEffect(() => {
    api('/api/servers/timeline').then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <PageHead
        title="Timeline"
        summary={data ? `${data.scheduled.length} renewal${data.scheduled.length === 1 ? '' : 's'} scheduled${data.unscheduled.length ? ` · ${data.unscheduled.length} without a day` : ''}` : null}
      />

      {error && <p className="banner">{error}</p>}
      {!data && !error && <Loading label="Drawing the line…" />}

      {data && (
        <>
          <div className="time-now">Today · {data.today}</div>
          {data.scheduled.length === 0 && (
            <Empty>No renewal days yet. Set a server due day on a project to see it here.</Empty>
          )}
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
                  <p>{project.serverName || 'Server not named'}{project.url ? ` · ${project.url}` : ''}</p>
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
                    <span className="list-end">
                      <span className="muted">{project.serverName}</span>
                      <Link className="mini-action" to={`/projects/${project.id}`}>Set due day</Link>
                    </span>
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
