import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Account() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
  }, [user]);

  async function saveName(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await api('/api/auth/me', { method: 'PATCH', body: { name } });
      setUser(updated);
      setMessage('Name updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/api/auth/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <p className="kicker">Studio login</p>
          <h1>Account</h1>
        </div>
      </header>
      {message && <p className="banner ok">{message}</p>}
      {error && <p className="banner">{error}</p>}

      <form className="card form-card" onSubmit={saveName}>
        <h2>Profile</h2>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input value={user?.email || ''} disabled />
        </label>
        <button className="btn" disabled={busy} type="submit">Save name</button>
      </form>

      <form className="card form-card" onSubmit={savePassword}>
        <h2>Password</h2>
        <label className="field">
          <span>Current password</span>
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        <label className="field">
          <span>New password</span>
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <button className="btn" disabled={busy} type="submit">Update password</button>
      </form>
    </div>
  );
}
