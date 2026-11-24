import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { inr, STATUSES, urlLinks } from '../format';

const EMPTY = {
  clientName: '',
  leadBy: '',
  status: 'Under Discussion',
  payment: '',
  serverName: '',
  serverOs: '',
  ip: '',
  serverUsername: '',
  serverPassword: '',
  serverDueDay: '',
  monthlyServerCost: '',
  url: '',
  notes: '',
  clearPassword: false,
  hasPassword: false,
};

export default function ProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [leads, setLeads] = useState(['Muthu', 'Vicky', 'Dinesh', 'Lin']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [confirming, setConfirming] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logged, setLogged] = useState(0);

  useEffect(() => {
    api('/api/projects')
      .then((rows) => {
        const names = [...new Set(rows.map((project) => project.leadBy).filter(Boolean))];
        setLeads((current) => [...new Set([...current, ...names])].sort());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api(`/api/projects/${id}`)
      .then((project) => {
        setLogged(project.received || 0);
        setForm({
          ...EMPTY,
          clientName: project.clientName || '',
          leadBy: project.leadBy || '',
          status: project.status,
          payment: project.payment ?? '',
          serverName: project.serverName || '',
          serverOs: project.serverOs || '',
          ip: project.ip || '',
          serverUsername: project.serverUsername || '',
          serverDueDay: project.serverDueDay ?? '',
          monthlyServerCost: project.monthlyServerCost ?? '',
          url: project.url || '',
          notes: project.notes || '',
          hasPassword: project.hasPassword,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const budget = form.payment === '' ? null : Number(form.payment);
  const open = budget == null || Number.isNaN(budget) ? null : Math.max(budget - logged, 0);

  async function reveal() {
    try {
      const data = await api(`/api/projects/${id}/reveal`, { method: 'POST', body: {} });
      set('serverPassword', data.serverPassword || '');
      set('clearPassword', false);
      setShowPassword(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      clientName: form.clientName,
      leadBy: form.leadBy,
      status: form.status,
      payment: form.payment,
      serverName: form.serverName,
      serverOs: form.serverOs,
      ip: form.ip,
      serverUsername: form.serverUsername,
      serverDueDay: form.serverDueDay,
      monthlyServerCost: form.monthlyServerCost,
      url: form.url,
      notes: form.notes,
      clearPassword: form.clearPassword,
    };
    if (form.serverPassword) payload.serverPassword = form.serverPassword;
    try {
      const saved = await api(id ? `/api/projects/${id}` : '/api/projects', {
        method: id ? 'PUT' : 'POST',
        body: payload,
      });
      navigate(`/projects/${saved.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' });
      navigate('/projects');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (loading) return <p className="kicker page">Loading project…</p>;

  return (
    <form className="page" onSubmit={onSubmit}>
      <header className="page-head">
        <div>
          <p className="kicker">{id ? `Project #${id}` : 'New record'}</p>
          <h1>{form.clientName || 'Untitled client'}</h1>
        </div>
        <Link className="btn secondary" to="/projects">Back</Link>
      </header>
      {error && <p className="banner">{error}</p>}

      <section className="card form-card">
        <h2>Client</h2>
        <div className="grid-2">
          <label className="field">
            <span>Client</span>
            <input value={form.clientName} onChange={(event) => set('clientName', event.target.value)} required />
          </label>
          <label className="field">
            <span>Lead by</span>
            <input list="leads" value={form.leadBy} onChange={(event) => set('leadBy', event.target.value)} />
            <datalist id="leads">
              {leads.map((lead) => <option key={lead} value={lead} />)}
            </datalist>
          </label>
          <label className="field">
            <span>Project status</span>
            <select value={form.status} onChange={(event) => set('status', event.target.value)}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card form-card">
        <h2>Software budget</h2>
        <label className="field">
          <span>Total software budget (₹)</span>
          <input type="number" min="0" step="1" value={form.payment} onChange={(event) => set('payment', event.target.value)} />
        </label>
        <p className="received">
          Logged so far <strong>{inr(logged)}</strong>
          {open != null && <> · still open <strong className={open ? 'money-due' : 'money-clear'}>{open ? inr(open) : 'Clear'}</strong></>}
        </p>
        {id ? (
          <Link to={`/payments?project=${id}`}>Log a payment for this project</Link>
        ) : null}
      </section>

      <section className="card form-card">
        <h2>Server</h2>
        <div className="grid-2">
          <label className="field">
            <span>Server name</span>
            <input value={form.serverName} onChange={(event) => set('serverName', event.target.value)} />
          </label>
          <label className="field">
            <span>Server OS</span>
            <input list="oses" value={form.serverOs} onChange={(event) => set('serverOs', event.target.value)} />
            <datalist id="oses">
              <option value="Ubuntu" />
              <option value="Windows" />
              <option value="Local" />
            </datalist>
          </label>
          <label className="field">
            <span>IP</span>
            <input value={form.ip} onChange={(event) => set('ip', event.target.value)} />
          </label>
          <label className="field">
            <span>Username</span>
            <input value={form.serverUsername} onChange={(event) => set('serverUsername', event.target.value)} autoComplete="off" />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="inline-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.serverPassword}
                onChange={(event) => set('serverPassword', event.target.value)}
                placeholder=""
                autoComplete="new-password"
              />
              <button type="button" className="btn secondary" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {id && form.hasPassword && !form.serverPassword && (
              <button type="button" className="text-btn" onClick={reveal}>Reveal saved password</button>
            )}
            {id && form.hasPassword && (
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  set('clearPassword', !form.clearPassword);
                  set('serverPassword', '');
                }}
              >
                {form.clearPassword ? 'Keep the saved password' : 'Remove the saved password'}
              </button>
            )}
          </label>
          <label className="field">
            <span>Server due day</span>
            <input
              type="number"
              min="1"
              max="31"
              value={form.serverDueDay}
              onChange={(event) => set('serverDueDay', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Monthly server cost (₹)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.monthlyServerCost}
              onChange={(event) => set('monthlyServerCost', event.target.value)}
            />
          </label>
          <label className="field span-2">
            <span>URL</span>
            <input value={form.url} onChange={(event) => set('url', event.target.value)} />
            {urlLinks(form.url).length > 0 && (
              <span className="link-row">
                {urlLinks(form.url).map((link) => (
                  <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
                ))}
              </span>
            )}
          </label>
          <label className="field span-2">
            <span>Notes</span>
            <textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} rows={4} />
          </label>
        </div>
      </section>

      <div className="form-actions">
        <button className="btn" type="submit" disabled={busy}>{busy && !confirming ? 'Saving…' : 'Save project'}</button>
        {id && (
          <button type="button" className="btn danger" onClick={remove} disabled={busy}>
            {confirming ? (busy ? 'Deleting…' : 'Confirm delete') : 'Delete'}
          </button>
        )}
      </div>
    </form>
  );
}
