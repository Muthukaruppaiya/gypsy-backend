import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { dueLabel, inr, STATUSES, urlLinks } from '../format';
import { Empty, Loading, PageHead, statusKey, useToast, usePageTitle } from '../components/ui';

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
  const [due, setDue] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState(JSON.stringify(EMPTY));
  const topRef = useRef(null);
  const notify = useToast();
  const { isAdmin } = useAuth();
  usePageTitle(id ? form.clientName || `Project #${id}` : 'New project');

  const dirty = useMemo(() => JSON.stringify(form) !== saved, [form, saved]);

  useEffect(() => {
    if (!dirty) return undefined;
    function warn(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    api('/api/projects')
      .then((rows) => {
        const names = [...new Set(rows.map((project) => project.leadBy).filter(Boolean))];
        setLeads((current) => [...new Set([...current, ...names])].sort());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) {
      setForm(EMPTY);
      setSaved(JSON.stringify(EMPTY));
      setLogged(0);
      setDue(null);
      return;
    }
    setLoading(true);
    setLoadError('');
    setConfirming(false);
    setShowPassword(false);
    api(`/api/projects/${id}`)
      .then((project) => {
        setLogged(project.received || 0);
        setDue(project.serverDueDay ? { days: project.daysUntilDue, date: project.nextDueDate } : null);
        const next = {
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
        };
        setForm(next);
        setSaved(JSON.stringify(next));
      })
      .catch((err) => setLoadError(err.message))
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
      const value = data.serverPassword || '';
      setForm((current) => ({ ...current, serverPassword: value, clearPassword: false }));
      // A revealed password is not an edit, so keep it out of the unsaved check.
      setSaved((current) => JSON.stringify({ ...JSON.parse(current), serverPassword: value, clearPassword: false }));
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
      const result = await api(id ? `/api/projects/${id}` : '/api/projects', {
        method: id ? 'PUT' : 'POST',
        body: payload,
      });
      if (id) {
        const next = { ...form, serverPassword: '', clearPassword: false, hasPassword: result.hasPassword };
        setForm(next);
        setSaved(JSON.stringify(next));
        setShowPassword(false);
        setLogged(result.received || 0);
        setDue(result.serverDueDay ? { days: result.daysUntilDue, date: result.nextDueDate } : null);
        notify(`${result.clientName} saved.`);
      } else {
        setSaved(JSON.stringify(form));
        notify(`${result.clientName} added to the book.`, isAdmin ? {
          action: { label: 'Log a payment', to: `/payments?project=${result.id}` },
          timeout: 7000,
        } : undefined);
        navigate(`/projects/${result.id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      setSaved(JSON.stringify(form));
      notify(`${form.clientName || 'Project'} deleted.`);
      navigate('/projects');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function goBack(event) {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) {
      event.preventDefault();
    }
  }

  if (loading) return <Loading label="Loading project…" />;
  if (loadError) {
    return (
      <div className="page narrow">
        <PageHead crumbs={[{ label: 'Projects', to: '/projects' }, { label: `#${id}` }]} title="Project not found" />
        <Empty action={<Link className="btn" to="/projects">Back to projects</Link>}>
          {loadError} It may have been deleted.
        </Empty>
      </div>
    );
  }

  return (
    <form className="page" onSubmit={onSubmit} ref={topRef}>
      <PageHead
        crumbs={[{ label: 'Projects', to: '/projects', onClick: goBack }, { label: id ? `#${id}` : 'New' }]}
        title={form.clientName || (id ? 'Untitled client' : 'New project')}
        meta={id ? (
            <div className="head-meta">
              <span className={`pill pill-${statusKey(form.status)}`}>{form.status}</span>
              {isAdmin && due && <span className="muted tiny">Server renewal {dueLabel(due.days, due.date)}</span>}
              {urlLinks(form.url).slice(0, 1).map((link) => (
                <a key={link.label} className="tiny" href={link.href} target="_blank" rel="noreferrer">Open site ↗</a>
              ))}
            </div>
          ) : null}
      >
        <Link className="btn secondary" to="/projects" onClick={goBack}>Back</Link>
      </PageHead>
      {error && <p className="banner">{error}</p>}

      <section className="card form-card">
        <h2>Client</h2>
        <div className="grid-2">
          <label className="field">
            <span>Client <em className="req">required</em></span>
            <input value={form.clientName} onChange={(event) => set('clientName', event.target.value)} required minLength={2} autoFocus={!id} />
          </label>
          <label className="field">
            <span>Lead by</span>
            <input list="leads" value={form.leadBy} onChange={(event) => set('leadBy', event.target.value)} />
            <datalist id="leads">
              {leads.map((lead) => <option key={lead} value={lead} />)}
            </datalist>
          </label>
          <div className="field span-2">
            <span>Project status</span>
            <div className="segmented" role="radiogroup" aria-label="Project status">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="radio"
                  aria-checked={form.status === status}
                  className={`seg seg-${statusKey(status)}${form.status === status ? ' on' : ''}`}
                  onClick={() => set('status', status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
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
        {budget != null && budget > 0 && (
          <div className="meter slim" aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.round((logged / budget) * 100))}%` }} />
          </div>
        )}
        {isAdmin && (id ? (
          <Link className="btn secondary fit" to={`/payments?project=${id}`} onClick={goBack}>Log a payment for this project</Link>
        ) : (
          <p className="hint">You can log payments once the project is saved.</p>
        ))}
        {!isAdmin && <p className="hint">Payments are logged by an admin. Tell them when the client pays.</p>}
      </section>

      <section className="card form-card">
        <h2>Website &amp; notes</h2>
        <div className="grid-2">
          <label className="field span-2">
            <span>URL <small>(separate several with commas)</small></span>
            <input value={form.url} onChange={(event) => set('url', event.target.value)} placeholder="example.com, admin.example.com" />
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

      {isAdmin && (
      <section className="card form-card admin-card">
        <div className="card-head">
          <h2>Server</h2>
          <span className="role-badge role-admin">Admin only</span>
        </div>
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
            <span>Server due day <small>(day of the month, 1–31)</small></span>
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
        </div>
      </section>
      )}

      <div className="form-actions sticky-actions">
        <button className="btn" type="submit" disabled={busy || (id && !dirty)}>
          {busy && !confirming ? 'Saving…' : id ? (dirty ? 'Save changes' : 'Saved') : 'Create project'}
        </button>
        {dirty && <span className="unsaved">Unsaved changes</span>}
        {id && isAdmin && (
          <span className="danger-zone">
            {confirming && (
              <>
                <span className="muted tiny">Its payments and server log entries are deleted with it.</span>
                <button type="button" className="btn secondary" onClick={() => setConfirming(false)} disabled={busy}>Keep it</button>
              </>
            )}
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>
              {confirming ? (busy ? 'Deleting…' : 'Yes, delete') : 'Delete'}
            </button>
          </span>
        )}
      </div>
    </form>
  );
}
