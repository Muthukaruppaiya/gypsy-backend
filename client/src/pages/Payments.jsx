import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { inr } from '../format';

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function pretty(iso) {
  if (!iso) return 'Date not recorded';
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const BLANK = { id: null, projectId: '', amount: '', paidOn: todayISO(), note: '' };

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const projectFilter = params.get('project') || '';

  function load() {
    api('/api/payments/receipts').then(setReceipts).catch(() => {});
    return api('/api/payments').then(setData).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (projectFilter) setForm((current) => ({ ...current, projectId: projectFilter }));
  }, [projectFilter]);

  const projects = data?.projects || [];
  const payments = useMemo(() => {
    const rows = data?.payments || [];
    if (!projectFilter) return rows;
    return rows.filter((payment) => String(payment.projectId) === projectFilter);
  }, [data, projectFilter]);

  const totals = useMemo(() => {
    const source = projectFilter
      ? projects.filter((project) => String(project.id) === projectFilter)
      : projects;
    return source.reduce((acc, project) => {
      if (project.payment != null) acc.budget += project.payment;
      if (project.received != null) acc.collected += project.received;
      if (project.balance != null) acc.open += project.balance;
      return acc;
    }, { budget: 0, collected: 0, open: 0 });
  }, [projects, projectFilter]);

  function setFilter(value) {
    const next = new URLSearchParams(params);
    if (value) next.set('project', value);
    else next.delete('project');
    setParams(next);
  }

  function edit(payment) {
    setForm({
      id: payment.id,
      projectId: String(payment.projectId),
      amount: String(payment.amount),
      paidOn: payment.paidOn || todayISO(),
      note: payment.note || '',
    });
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      projectId: Number(form.projectId),
      amount: form.amount,
      paidOn: form.paidOn,
      note: form.note,
    };
    try {
      if (form.id) await api(`/api/payments/${form.id}`, { method: 'PUT', body });
      else await api('/api/payments', { method: 'POST', body });
      setForm({ ...BLANK, projectId: form.projectId });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(payment) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/payments/${payment.id}`, { method: 'DELETE' });
      if (form.id === payment.id) setForm({ ...BLANK, projectId: form.projectId });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Payments</h1>
        </div>
      </header>

      {error && <p className="banner">{error}</p>}

      <section className="status-row">
        <article className="stat">
          <p>Software budget</p>
          <strong>{inr(totals.budget)}</strong>
          <span>{projectFilter ? 'This project' : 'All projects'}</span>
        </article>
        <article className="stat">
          <p>Collected</p>
          <strong>{inr(totals.collected)}</strong>
          <span>{payments.length} payment{payments.length === 1 ? '' : 's'} in view</span>
        </article>
        <article className="stat">
          <p>Still open</p>
          <strong className={totals.open ? 'due-number' : ''}>{inr(totals.open)}</strong>
          <span />
        </article>
      </section>

      <section className="split pay-split">
        <form className="card form-card" onSubmit={save}>
          <h2>{form.id ? 'Edit payment' : 'Log a payment'}</h2>
          <label className="field">
            <span>Project</span>
            <select
              value={form.projectId}
              onChange={(event) => setForm({ ...form, projectId: event.target.value })}
              required
            >
              <option value="">Choose a client</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.clientName}</option>
              ))}
            </select>
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Amount (₹)</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Received on</span>
              <input
                type="date"
                value={form.paidOn}
                onChange={(event) => setForm({ ...form, paidOn: event.target.value })}
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Note</span>
            <input
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder=""
            />
          </label>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Update payment' : 'Save payment'}</button>
            {form.id && (
              <button
                className="btn secondary"
                type="button"
                onClick={() => setForm({ ...BLANK, projectId: form.projectId })}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <article className="card">
          <div className="card-head">
            <h2>Against the budget</h2>
            <label className="field slim">
              <span className="sr">Filter</span>
              <select value={projectFilter} onChange={(event) => setFilter(event.target.value)}>
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.clientName}</option>
                ))}
              </select>
            </label>
          </div>
          <ul className="watch">
            {(projectFilter ? projects.filter((project) => String(project.id) === projectFilter) : projects.filter((project) => project.payment != null || project.received))
              .map((project) => {
                const width = project.payment ? Math.min(100, Math.round(((project.received || 0) / project.payment) * 100)) : 0;
                return (
                  <li key={project.id}>
                    <div className="pay-project">
                      <Link to={`/projects/${project.id}`}>{project.clientName}</Link>
                      <div className="meter slim"><span style={{ width: `${width}%` }} /></div>
                      <small>{inr(project.received || 0)} of {inr(project.payment)}</small>
                    </div>
                    <span className={project.balance ? 'money-due' : 'money-clear'}>
                      {project.payment == null ? 'No budget' : project.balance ? inr(project.balance) : 'Clear'}
                    </span>
                  </li>
                );
              })}
          </ul>
        </article>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Payment log</h2>
        </div>
        {!data && <p className="muted">Loading payments…</p>}
        {data && payments.length === 0 && <p className="muted">—</p>}
        {payments.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Note</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.txnNo ? <span className="txn">{payment.txnNo}</span> : '—'}</td>
                    <td>{pretty(payment.paidOn)}</td>
                    <td><Link className="client-link" to={`/projects/${payment.projectId}`}>{payment.clientName}</Link></td>
                    <td>{inr(payment.amount)}</td>
                    <td>{payment.note || '—'}</td>
                    <td className="row-actions">
                      <button type="button" className="text-btn" onClick={() => edit(payment)}>Edit</button>
                      <button type="button" className="text-btn danger-text" onClick={() => remove(payment)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>All receipts</h2>
        </div>
        {receipts.length === 0 && <p className="muted">—</p>}
        {receipts.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Kind</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={`${receipt.kind}-${receipt.txnNo}`}>
                    <td><span className="txn">{receipt.txnNo}</span></td>
                    <td>{receipt.kind}</td>
                    <td>{pretty(receipt.happenedOn)}</td>
                    <td><Link className="client-link" to={`/projects/${receipt.projectId}`}>{receipt.clientName}</Link></td>
                    <td>{inr(receipt.amount)}</td>
                    <td>{receipt.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
