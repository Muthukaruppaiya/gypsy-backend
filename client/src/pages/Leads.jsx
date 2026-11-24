import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { followUpLabel } from '../format';

function pad(value) {
  return String(value).padStart(2, '0');
}

function toLocalInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function chipTimes(now = new Date()) {
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  if (evening <= now) evening.setDate(evening.getDate() + 1);
  const morning = new Date(now);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(10, 0, 0, 0);
  const later = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  return [
    { id: 'hour', label: 'In an hour', value: toLocalInput(new Date(now.getTime() + 60 * 60 * 1000)) },
    { id: 'evening', label: 'This evening', value: toLocalInput(evening) },
    { id: 'morning', label: 'Tomorrow morning', value: toLocalInput(morning) },
    { id: 'later', label: 'After a couple of days', value: toLocalInput(later) },
  ];
}

const BLANK = { id: null, clientName: '', phone: '', note: '', followUpAt: '', calledBy: '', status: 'Open' };

export default function Leads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(BLANK);
  const [chip, setChip] = useState('');
  const [busy, setBusy] = useState(false);
  const [addingCaller, setAddingCaller] = useState(false);
  const [caller, setCaller] = useState({ name: '', email: '', password: '' });
  const [callerNote, setCallerNote] = useState('');
  const times = useMemo(() => chipTimes(), []);

  function load() {
    return api('/api/leads').then(setData).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (user && !form.id && !form.calledBy) {
      setForm((current) => ({ ...current, calledBy: String(user.id) }));
    }
  }, [user, form.id, form.calledBy]);

  function changed() {
    window.dispatchEvent(new Event('gypsy-leads'));
  }

  function edit(lead) {
    const local = toLocalInput(new Date(lead.followUpAt));
    setForm({
      id: lead.id,
      clientName: lead.clientName,
      phone: lead.phone || '',
      note: lead.note || '',
      followUpAt: local,
      calledBy: lead.calledBy ? String(lead.calledBy) : '',
      status: lead.status === 'Closed' ? 'Closed' : 'Open',
    });
    setChip(times.find((item) => item.value === local)?.id || '');
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      clientName: form.clientName,
      phone: form.phone,
      note: form.note,
      followUpAt: fromLocalInput(form.followUpAt),
      calledBy: form.calledBy ? Number(form.calledBy) : undefined,
      status: form.status,
    };
    try {
      if (form.id) await api(`/api/leads/${form.id}`, { method: 'PUT', body });
      else await api('/api/leads', { method: 'POST', body });
      setForm({ ...BLANK, calledBy: String(user?.id || '') });
      setChip('');
      await load();
      changed();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function snooze(lead) {
    setError('');
    try {
      await api(`/api/leads/${lead.id}/snooze`, { method: 'POST', body: { minutes: 60 } });
      await load();
      changed();
    } catch (err) {
      setError(err.message);
    }
  }

  async function convert(lead) {
    setBusy(true);
    setError('');
    try {
      const result = await api(`/api/leads/${lead.id}/convert`, { method: 'POST', body: {} });
      changed();
      navigate(`/projects/${result.project.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function setStatus(lead, status) {
    setError('');
    try {
      await api(`/api/leads/${lead.id}`, {
        method: 'PUT',
        body: {
          clientName: lead.clientName,
          phone: lead.phone,
          note: lead.note,
          followUpAt: lead.followUpAt,
          calledBy: lead.calledBy,
          status,
        },
      });
      await load();
      changed();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(lead) {
    setError('');
    try {
      await api(`/api/leads/${lead.id}`, { method: 'DELETE' });
      if (form.id === lead.id) setForm({ ...BLANK, calledBy: String(user?.id || '') });
      await load();
      changed();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addCaller(event) {
    event.preventDefault();
    setBusy(true);
    setCallerNote('');
    setError('');
    try {
      const created = await api('/api/auth/users', { method: 'POST', body: caller });
      setCaller({ name: '', email: '', password: '' });
      setAddingCaller(false);
      setCallerNote(`${created.name} can sign in with ${created.email}.`);
      setForm((current) => ({ ...current, calledBy: String(created.id) }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const leads = data?.leads || [];
  const now = Date.now();
  const due = leads.filter((lead) => lead.status === 'Open' && new Date(lead.followUpAt).getTime() <= now);
  const waiting = leads.filter((lead) => lead.status === 'Open' && new Date(lead.followUpAt).getTime() > now);
  const finished = leads.filter((lead) => lead.status !== 'Open');

  function LeadCard({ lead }) {
    const overdue = lead.status === 'Open' && new Date(lead.followUpAt).getTime() <= now;
    return (
      <article className={`lead-card${overdue ? ' due' : ''}`}>
        <div>
          <p className="kicker">{lead.status === 'Open' ? followUpLabel(lead.followUpAt) : lead.status}</p>
          <strong>{lead.callerName || 'Unassigned'}</strong>
        </div>
        <div>
          <h2>{lead.clientName}</h2>
          {lead.phone && <p className="muted">{lead.phone}</p>}
          <p>{lead.note}</p>
        </div>
        <div className="lead-actions">
          {lead.status === 'Open' && (
            <>
              <button type="button" className="btn" onClick={() => convert(lead)} disabled={busy}>Make a project</button>
              <button type="button" className="text-btn" onClick={() => snooze(lead)}>Remind in an hour</button>
              <button type="button" className="text-btn" onClick={() => edit(lead)}>Edit</button>
              <button type="button" className="text-btn" onClick={() => setStatus(lead, 'Closed')}>Close</button>
            </>
          )}
          {lead.status === 'Converted' && lead.projectId && (
            <Link className="btn secondary" to={`/projects/${lead.projectId}`}>Open project</Link>
          )}
          {lead.status === 'Closed' && (
            <button type="button" className="text-btn" onClick={() => setStatus(lead, 'Open')}>Reopen</button>
          )}
          {lead.status !== 'Converted' && (
            <button type="button" className="text-btn danger-text" onClick={() => remove(lead)}>Remove</button>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Leads</h1>
        </div>
      </header>

      {error && <p className="banner">{error}</p>}
      {callerNote && <p className="banner ok">{callerNote}</p>}

      <section className="split pay-split">
        <form className="card form-card" onSubmit={save}>
          <h2>{form.id ? 'Edit lead' : 'Log a call'}</h2>
          <label className="field">
            <span>Client</span>
            <input value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} required />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Phone</span>
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </label>
            <label className="field">
              <span>Called by</span>
              <select value={form.calledBy} onChange={(event) => setForm({ ...form, calledBy: event.target.value })} required>
                <option value="">Choose a caller</option>
                {(data?.users || []).map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>What they said</span>
            <textarea
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder=""
              required
            />
          </label>
          <div className="field">
            <span>Call back</span>
            <div className="chips">
              {times.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip${chip === item.id ? ' on' : ''}`}
                  onClick={() => {
                    setChip(item.id);
                    setForm({ ...form, followUpAt: item.value });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <input
              type="datetime-local"
              value={form.followUpAt}
              onChange={(event) => {
                setChip('');
                setForm({ ...form, followUpAt: event.target.value });
              }}
              required
            />
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Update lead' : 'Save lead'}</button>
            {form.id && (
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  setForm({ ...BLANK, calledBy: String(user?.id || '') });
                  setChip('');
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <article className="card">
          <div className="card-head">
            <h2>Callers</h2>
            <button type="button" className="text-btn" onClick={() => setAddingCaller((value) => !value)}>
              {addingCaller ? 'Close' : 'Add a caller'}
            </button>
          </div>
          <ul className="list">
            {(data?.users || []).map((person) => (
              <li key={person.id}>
                <span>{person.name}</span>
                <span className="muted">{person.email}</span>
              </li>
            ))}
          </ul>
          {addingCaller && (
            <form className="caller-form" onSubmit={addCaller}>
              <label className="field">
                <span>Name</span>
                <input value={caller.name} onChange={(event) => setCaller({ ...caller, name: event.target.value })} required />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={caller.email} onChange={(event) => setCaller({ ...caller, email: event.target.value })} required />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" minLength={8} value={caller.password} onChange={(event) => setCaller({ ...caller, password: event.target.value })} required />
              </label>
              <button className="btn" type="submit" disabled={busy}>Save caller</button>
            </form>
          )}
        </article>
      </section>

      {!data && <p className="kicker">Opening the call book…</p>}

      <section className="group">
        <div className="group-head">
          <h2>Due now</h2>
          <p>{due.length}</p>
        </div>
        <div className="lead-board">
          {due.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
        </div>
      </section>

      <section className="group">
        <div className="group-head">
          <h2>Later</h2>
          <p>{waiting.length}</p>
        </div>
        <div className="lead-board">
          {waiting.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
        </div>
      </section>

      {finished.length > 0 && (
        <section className="group">
          <div className="group-head">
            <h2>Finished</h2>
            <p>{finished.length}</p>
          </div>
          <div className="lead-board">
            {finished.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
          </div>
        </section>
      )}
    </div>
  );
}
