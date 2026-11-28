import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ConfirmButton, Empty, Loading, PageHead, useToast, usePageTitle } from '../components/ui';

const ROLE_INFO = {
  admin: { label: 'Admin', blurb: 'Everything: servers, passwords, payments, hosting log, team.' },
  sales: { label: 'Sales', blurb: 'Leads, follow-ups, and projects without server details.' },
};

const BLANK = { name: '', email: '', password: '', role: 'sales' };

export default function Team() {
  usePageTitle('Team');
  const { user } = useAuth();
  const notify = useToast();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [resetPassword, setResetPassword] = useState('');

  function load() {
    return api('/api/auth/users').then(setPeople).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await api('/api/auth/users', { method: 'POST', body: form });
      notify(`${created.name} added as ${ROLE_INFO[created.role].label}. They sign in with ${created.email}.`, { timeout: 7000 });
      setForm(BLANK);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(person, role) {
    setError('');
    try {
      await api(`/api/auth/users/${person.id}`, { method: 'PATCH', body: { role } });
      notify(`${person.name} is now ${ROLE_INFO[role].label}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(person) {
    setError('');
    try {
      await api(`/api/auth/users/${person.id}`, { method: 'DELETE' });
      notify(`${person.name} removed. Their leads are kept as unassigned.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setError('');
    try {
      await api(`/api/auth/users/${resetFor.id}/password`, { method: 'POST', body: { password: resetPassword } });
      notify(`New password set for ${resetFor.name}. Share it with them privately.`);
      setResetFor(null);
      setResetPassword('');
    } catch (err) {
      setError(err.message);
    }
  }

  const admins = (people || []).filter((person) => person.role === 'admin').length;

  return (
    <div className="page">
      <PageHead
        title="Team"
        summary={people ? `${people.length} ${people.length === 1 ? 'person' : 'people'} · ${admins} admin${admins === 1 ? '' : 's'}` : null}
      />

      {error && <p className="banner">{error}</p>}

      <section className="role-cards">
        {Object.entries(ROLE_INFO).map(([key, info]) => (
          <article key={key} className={`role-card role-${key}`}>
            <span className={`role-badge role-${key}`}>{info.label}</span>
            <p>{info.blurb}</p>
          </article>
        ))}
      </section>

      <section className="split pay-split">
        <article className="card">
          <div className="card-head">
            <h2>People</h2>
            <span className="muted tiny">{people ? `${people.length} logins` : ''}</span>
          </div>
          {!people && !error && <Loading label="Loading the team…" />}
          {people && people.length === 0 && <Empty>No one yet.</Empty>}
          <ul className="people">
            {(people || []).map((person) => (
              <li key={person.id}>
                <span className={`avatar role-${person.role}`} aria-hidden="true">{person.name.slice(0, 1).toUpperCase()}</span>
                <div className="person-main">
                  <strong>{person.name}{person.id === user?.id && <span className="muted"> (you)</span>}</strong>
                  <p className="muted tiny">{person.email}{person.openLeads ? ` · ${person.openLeads} open lead${person.openLeads === 1 ? '' : 's'}` : ''}</p>
                </div>
                <label className="field slim role-select">
                  <span className="sr">Role for {person.name}</span>
                  <select
                    value={person.role}
                    onChange={(event) => changeRole(person, event.target.value)}
                    disabled={person.role === 'admin' && admins <= 1}
                    title={person.role === 'admin' && admins <= 1 ? 'Keep at least one admin' : undefined}
                  >
                    <option value="admin">Admin</option>
                    <option value="sales">Sales</option>
                  </select>
                </label>
                <div className="person-actions">
                  <button type="button" className="text-btn" onClick={() => { setResetFor(person); setResetPassword(''); }}>
                    Reset password
                  </button>
                  {person.id !== user?.id && !(person.role === 'admin' && admins <= 1) && (
                    <ConfirmButton confirmLabel="Remove login" onConfirm={() => remove(person)}>Remove</ConfirmButton>
                  )}
                </div>
                {resetFor?.id === person.id && (
                  <form className="reset-row" onSubmit={savePassword}>
                    <label className="field">
                      <span>New password for {person.name}</span>
                      <input type="text" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} minLength={8} required autoFocus autoComplete="off" />
                    </label>
                    <div className="form-actions">
                      <button className="btn" type="submit">Set password</button>
                      <button className="btn secondary" type="button" onClick={() => setResetFor(null)}>Cancel</button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </article>

        <form className="card form-card" onSubmit={add}>
          <h2>Add a person</h2>
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} />
          </label>
          <label className="field">
            <span>Email they sign in with</span>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoComplete="off" />
          </label>
          <label className="field">
            <span>Starting password</span>
            <input type="text" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} required autoComplete="off" />
            <small>At least 8 characters. They can change it under Account.</small>
          </label>
          <div className="field">
            <span>Role</span>
            <div className="segmented" role="radiogroup" aria-label="Role">
              {Object.entries(ROLE_INFO).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={form.role === key}
                  className={`seg${form.role === key ? ' on' : ''}`}
                  onClick={() => setForm({ ...form, role: key })}
                >
                  {info.label}
                </button>
              ))}
            </div>
            <small>{ROLE_INFO[form.role].blurb}</small>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add to the team'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
