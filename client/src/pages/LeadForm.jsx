import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { followUpLabel } from '../format';
import { chipTimes, fromLocalInput, toLocalInput } from '../leadTime';
import { Empty, Loading, PageHead, useToast, usePageTitle } from '../components/ui';

const BLANK = { clientName: '', phone: '', note: '', followUpAt: '', calledBy: '', status: 'Open' };

export default function LeadForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  usePageTitle(editing ? 'Edit lead' : 'Log a call');

  const [form, setForm] = useState({ ...BLANK, calledBy: user ? String(user.id) : '' });
  const [users, setUsers] = useState([]);
  const [chip, setChip] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [another, setAnother] = useState(false);
  const times = useMemo(() => chipTimes(), []);

  useEffect(() => {
    api('/api/leads')
      .then((data) => {
        setUsers(data.users || []);
        if (!editing) return;
        const lead = data.leads.find((item) => String(item.id) === String(id));
        if (!lead || lead.status === 'Converted') {
          setMissing(true);
          return;
        }
        const local = toLocalInput(new Date(lead.followUpAt));
        setForm({
          clientName: lead.clientName,
          phone: lead.phone || '',
          note: lead.note || '',
          followUpAt: local,
          calledBy: lead.calledBy ? String(lead.calledBy) : '',
          status: lead.status === 'Closed' ? 'Closed' : 'Open',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, editing]);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
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
      if (editing) await api(`/api/leads/${id}`, { method: 'PUT', body });
      else await api('/api/leads', { method: 'POST', body });
      window.dispatchEvent(new Event('gypsy-leads'));
      if (editing) {
        notify(`${form.clientName} updated.`);
        if (form.status === 'Closed') navigate('/leads/closed');
        else navigate(new Date(body.followUpAt).getTime() <= Date.now() ? '/leads/due' : '/leads/later');
        return;
      }
      notify(`Call with ${form.clientName} saved. Reminder: ${followUpLabel(body.followUpAt)}.`, {
        action: { label: 'See follow-ups', to: '/leads/later' },
      });
      if (another) {
        setForm({ ...BLANK, calledBy: form.calledBy });
        setChip('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const due = new Date(body.followUpAt).getTime() <= Date.now();
        navigate(due ? '/leads/due' : '/leads/later');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Opening the call book…" />;
  if (missing) {
    return (
      <div className="page narrow">
        <PageHead crumbs={[{ label: 'Follow-ups', to: '/leads' }, { label: 'Edit' }]} title="Lead not found" />
        <Empty action={<Link className="btn" to="/leads">Back to follow-ups</Link>}>
          This lead was removed or has already become a project.
        </Empty>
      </div>
    );
  }

  const noteLeft = 1000 - form.note.length;

  return (
    <div className="page narrow">
      <PageHead
        crumbs={[{ label: 'Follow-ups', to: '/leads' }, { label: editing ? 'Edit lead' : 'New call' }]}
        title={editing ? form.clientName || 'Edit lead' : 'Log a call'}
      />

      {error && <p className="banner">{error}</p>}

      <form className="card form-card form-steps" onSubmit={save}>
        <section className="step">
          <div className="step-head"><span className="step-no">1</span><h2>Who called</h2></div>
          <div className="grid-2">
            <label className="field span-2">
              <span>Client or company <em className="req">required</em></span>
              <input value={form.clientName} onChange={(event) => set('clientName', event.target.value)} required minLength={2} autoFocus={!editing} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input type="tel" inputMode="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} maxLength={30} placeholder="+91 98765 43210" />
            </label>
            <label className="field">
              <span>Handled by</span>
              <select value={form.calledBy} onChange={(event) => set('calledBy', event.target.value)} required>
                <option value="">Choose a person</option>
                {users.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}{person.id === user?.id ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="step">
          <div className="step-head"><span className="step-no">2</span><h2>What they said</h2></div>
          <label className="field">
            <span className="sr">Notes from the call</span>
            <textarea
              value={form.note}
              onChange={(event) => set('note', event.target.value)}
              placeholder="What they need, budget hints, when they want to start"
              maxLength={1000}
              rows={5}
              required
            />
            <small className={noteLeft < 80 ? 'warn-text' : ''}>{noteLeft} characters left</small>
          </label>
        </section>

        <section className="step">
          <div className="step-head"><span className="step-no">3</span><h2>Call back</h2></div>
          <div className="chips chip-grid">
            {times.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip${chip === item.id ? ' on' : ''}`}
                aria-pressed={chip === item.id}
                onClick={() => {
                  setChip(item.id);
                  set('followUpAt', item.value);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Or pick a date and time</span>
            <input
              type="datetime-local"
              value={form.followUpAt}
              onChange={(event) => {
                setChip('');
                set('followUpAt', event.target.value);
              }}
              required
            />
            {form.followUpAt && <small>Reminder {followUpLabel(fromLocalInput(form.followUpAt))}</small>}
          </label>
        </section>

        <div className="form-actions lead-actions-bar">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Save call'}
          </button>
          <Link className="btn secondary" to="/leads">Cancel</Link>
          {!editing && (
            <label className="check push-right">
              <input type="checkbox" checked={another} onChange={(event) => setAnother(event.target.checked)} />
              Log another after this
            </label>
          )}
        </div>
      </form>
    </div>
  );
}
