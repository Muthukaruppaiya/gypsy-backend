import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { dueLabel, dueTone, inr } from '../format';

export default function Automation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api('/api/projects/overview').then(setData).catch((err) => setError(err.message));
  }, []);

  async function copyDigest() {
    await navigator.clipboard.writeText(data.digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) return <p className="banner page">{error}</p>;
  if (!data) return <p className="kicker page">Checking renewals and balances…</p>;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker">{data.todayLabel}</p>
          <h1>Automation</h1>
        </div>
        <button type="button" className="btn" onClick={copyDigest}>{copied ? 'Copied' : 'Copy digest'}</button>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>Server renewals</h2>
        </div>
        <ul className="watch">
          {data.renewals.map((project) => (
            <li key={project.id}>
              <div>
                <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                <p>{project.serverName || 'Server not named'}{project.url ? ` · ${project.url}` : ''}</p>
              </div>
              <span className={`tone tone-${dueTone(project.daysUntilDue)}`}>{dueLabel(project.daysUntilDue, project.nextDueDate)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="split">
        <article className="card">
          <h2>Unpaid balances</h2>
          <ul className="watch">
            {data.unpaid.map((project) => (
              <li key={project.id}>
                <div>
                  <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                  <p>{project.leadBy || 'No lead'} · agreed {inr(project.payment)}</p>
                </div>
                <span className="money-due">{inr(project.balance)}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="card">
          <h2>Missing details</h2>
          <ul className="watch">
            {data.gaps.map((project) => (
              <li key={project.id}>
                <div>
                  <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                  <p>{project.missing.join(', ')}</p>
                </div>
                <span className="tone tone-soon">{project.status}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card">
        <h2>Digest</h2>
        <pre className="digest">{data.digest}</pre>
      </section>
    </div>
  );
}
