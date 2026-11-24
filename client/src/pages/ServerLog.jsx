import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { inr } from '../format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function compact(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

export default function ServerLog() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);

  function load(nextYear = year) {
    return api(`/api/servers/collections?year=${nextYear}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load(year);
  }, [year]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') setEditor(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const entries = useMemo(() => {
    const map = new Map();
    for (const entry of data?.entries || []) map.set(`${entry.projectId}-${entry.month}`, entry);
    return map;
  }, [data]);

  const rows = data?.projects || [];

  const totals = useMemo(() => {
    let logged = 0;
    let expected = 0;
    for (const entry of data?.entries || []) logged += entry.amount;
    for (const project of rows) {
      if (project.monthlyServerCost) expected += project.monthlyServerCost * 12;
    }
    const currentMonth = year === now.getFullYear() ? now.getMonth() + 1 : null;
    let monthExpected = 0;
    let monthLogged = 0;
    if (currentMonth) {
      for (const project of rows) {
        if (project.monthlyServerCost) monthExpected += project.monthlyServerCost;
        const entry = entries.get(`${project.id}-${currentMonth}`);
        if (entry) monthLogged += entry.amount;
      }
    }
    return {
      logged,
      expected,
      gap: Math.max(expected - logged, 0),
      monthExpected,
      monthLogged,
      currentMonth,
    };
  }, [data, rows, entries, year, now]);

  function openEditor(project, month) {
    const entry = entries.get(`${project.id}-${month}`);
    setEditor({
      project,
      month,
      id: entry?.id || null,
      txnNo: entry?.txnNo || null,
      amount: entry ? String(entry.amount) : (project.monthlyServerCost ?? ''),
      collectedOn: entry?.collectedOn || todayISO(),
      note: entry?.note || '',
    });
    setError('');
  }

  async function saveEntry(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = await api('/api/servers/collections', {
        method: 'PUT',
        body: {
          projectId: editor.project.id,
          year,
          month: editor.month,
          amount: editor.amount === '' ? 0 : editor.amount,
          collectedOn: editor.collectedOn,
          note: editor.note,
        },
      });
      setData((current) => {
        const without = current.entries.filter((entry) => entry.id !== saved.id && !(entry.projectId === saved.projectId && entry.month === saved.month));
        return { ...current, entries: [...without, saved] };
      });
      setEditor(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry() {
    if (!editor?.id) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/servers/collections/${editor.id}`, { method: 'DELETE' });
      setData((current) => ({
        ...current,
        entries: current.entries.filter((entry) => entry.id !== editor.id),
      }));
      setEditor(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const thisMonth = now.getMonth() + 1;

  return (
    <div className="page wide">
      <header className="page-head">
        <div>
          <h1>Server collection log</h1>
        </div>
        <div className="year-switch" aria-label="Year">
          <button type="button" onClick={() => setYear((value) => value - 1)} aria-label="Previous year">‹</button>
          <strong>{year}</strong>
          <button type="button" onClick={() => setYear((value) => value + 1)} aria-label="Next year">›</button>
        </div>
      </header>

      {error && !editor && <p className="banner">{error}</p>}

      <section className="ledger-summary">
        <article className="stat">
          <p>Logged in {year}</p>
          <strong>{inr(totals.logged)}</strong>
          <span>{data?.entries.length || 0} entries</span>
        </article>
        <article className="stat">
          <p>Expected for the year</p>
          <strong>{totals.expected ? inr(totals.expected) : '—'}</strong>
        </article>
        <article className="stat">
          <p>Still to log</p>
          <strong className={totals.gap ? 'due-number' : ''}>{totals.expected ? inr(totals.gap) : '—'}</strong>
        </article>
        <article className="stat accent-stat">
          <p>{totals.currentMonth ? `${MONTH_NAMES[totals.currentMonth - 1]} so far` : 'This month'}</p>
          <strong>{inr(totals.monthLogged)}</strong>
          <span>{totals.monthExpected ? `of ${inr(totals.monthExpected)}` : ''}</span>
        </article>
      </section>

      {!data && !error && <p className="kicker">Opening the log…</p>}

      {data && (
        <div className="table-wrap card ledger-card">
          <table className="ledger">
            <thead>
              <tr>
                <th>Client</th>
                <th>Rate</th>
                {MONTHS.map((month) => <th key={month}>{month}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={14} className="muted">—</td>
                </tr>
              )}
              {rows.map((project) => (
                <tr key={project.id}>
                  <td className="client-cell">
                    <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                    <small>
                      {project.serverName || project.status}
                      {project.serverDueDay ? ` · due day ${project.serverDueDay}` : ''}
                    </small>
                  </td>
                  <td className="rate">{project.monthlyServerCost ? compact(project.monthlyServerCost) : '—'}</td>
                  {MONTHS.map((label, index) => {
                    const month = index + 1;
                    const entry = entries.get(`${project.id}-${month}`);
                    const isNow = year === now.getFullYear() && month === thisMonth;
                    const past = year < now.getFullYear() || (year === now.getFullYear() && month <= thisMonth);
                    let kind = 'ahead';
                    if (entry && project.monthlyServerCost && entry.amount + 0.001 < project.monthlyServerCost) kind = 'short';
                    else if (entry) kind = 'got';
                    else if (past && project.monthlyServerCost) kind = 'open';
                    return (
                      <td key={label}>
                        <button
                          type="button"
                          className={`cell-btn ${kind}${isNow ? ' now' : ''}`}
                          onClick={() => openEditor(project, month)}
                          title={[entry?.txnNo, entry?.note].filter(Boolean).join(' · ') || `${project.clientName} · ${MONTH_NAMES[index]} ${year}`}
                        >
                          {entry ? compact(entry.amount) : '·'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor && (
        <div className="drawer-back" onClick={() => setEditor(null)}>
          <form className="drawer" onClick={(event) => event.stopPropagation()} onSubmit={saveEntry}>
            <p className="kicker">{MONTH_NAMES[editor.month - 1]} {year}</p>
            <h2>{editor.project.clientName}</h2>
            <p className="muted">
              {editor.project.serverName || 'Server not named'}
              {editor.project.monthlyServerCost ? ` · monthly rate ${inr(editor.project.monthlyServerCost)}` : ''}
            </p>
            {editor.txnNo && <p><span className="txn">{editor.txnNo}</span></p>}
            {error && <p className="banner">{error}</p>}
            <label className="field">
              <span>Amount collected (₹)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={editor.amount}
                onChange={(event) => setEditor({ ...editor, amount: event.target.value })}
                required
              />
              {editor.project.monthlyServerCost != null && (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setEditor({ ...editor, amount: String(editor.project.monthlyServerCost) })}
                >
                  Use the monthly rate, {inr(editor.project.monthlyServerCost)}
                </button>
              )}
            </label>
            <label className="field">
              <span>Collected on</span>
              <input
                type="date"
                value={editor.collectedOn}
                onChange={(event) => setEditor({ ...editor, collectedOn: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Note</span>
              <input
                value={editor.note}
                onChange={(event) => setEditor({ ...editor, note: event.target.value })}
                placeholder=""
              />
            </label>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</button>
              <button className="btn secondary" type="button" onClick={() => setEditor(null)}>Close</button>
            </div>
            {editor.id && (
              <button className="text-btn danger-text" type="button" onClick={removeEntry} disabled={busy}>
                Remove this month’s entry
              </button>
            )}
            <Link to={`/projects/${editor.project.id}`}>Edit the monthly rate on the project</Link>
          </form>
        </div>
      )}
    </div>
  );
}
