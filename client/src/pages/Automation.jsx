import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { dueLabel, dueTone, inr } from '../format';
import { Empty, Loading, PageHead, useToast, usePageTitle } from '../components/ui';

export default function Automation() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const notify = useToast();
  usePageTitle('Automation');

  useEffect(() => {
    api('/api/projects/overview').then(setData).catch((err) => setError(err.message));
  }, []);

  async function copyDigest() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.digest);
      } else {
        // Fallback for plain-http hosts where the Clipboard API is blocked.
        const area = document.createElement('textarea');
        area.value = data.digest;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        if (!ok) throw new Error('copy failed');
      }
    } catch {
      notify('Could not copy. Select the digest below and copy it by hand.', { tone: 'error' });
      return;
    }
    notify('Digest copied. Paste it into WhatsApp or email.');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) return <p className="banner">{error}</p>;
  if (!data) return <Loading label="Checking renewals and balances…" />;

  return (
    <div className="page">
      <PageHead
        title="Automation"
        summary={`${data.renewals.length} renewal${data.renewals.length === 1 ? '' : 's'} · ${data.unpaid.length} unpaid · ${data.gaps.length} incomplete`}
      >
        <button type="button" className="btn" onClick={copyDigest}>{copied ? 'Copied' : 'Copy digest'}</button>
      </PageHead>

      <section className="card">
        <div className="card-head">
          <h2>Server renewals</h2>
          <Link to="/timeline">Timeline →</Link>
        </div>
        {data.renewals.length === 0 && <Empty>No renewal days set on hosted projects.</Empty>}
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
          <div className="card-head">
            <h2>Unpaid balances</h2>
            <Link to="/payments">Payments →</Link>
          </div>
          {data.unpaid.length === 0 && <Empty>Nothing open. Every budget is paid.</Empty>}
          <ul className="watch">
            {data.unpaid.map((project) => (
              <li key={project.id}>
                <div>
                  <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                  <p>{project.leadBy || 'No lead'} · agreed {inr(project.payment)}</p>
                </div>
                <span className="list-end">
                  <span className="money-due">{inr(project.balance)}</span>
                  <Link className="mini-action" to={`/payments?project=${project.id}`}>Log payment</Link>
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article className="card">
          <div className="card-head">
            <h2>Missing details</h2>
          </div>
          {data.gaps.length === 0 && <Empty>Live and in-build records look complete.</Empty>}
          <ul className="watch">
            {data.gaps.map((project) => (
              <li key={project.id}>
                <div>
                  <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                  <p>Missing {project.missing.join(', ')}</p>
                </div>
                <Link className="mini-action" to={`/projects/${project.id}`}>Fill in</Link>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Digest</h2>
          <button type="button" className="text-btn" onClick={copyDigest}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <pre className="digest">{data.digest}</pre>
      </section>
    </div>
  );
}
