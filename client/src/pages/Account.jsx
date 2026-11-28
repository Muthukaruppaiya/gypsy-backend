import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHead, useToast, usePageTitle } from '../components/ui';

export default function Account() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const notify = useToast();
  usePageTitle('Account');

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
      notify('Name updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Choose a password different from the current one.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/auth/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify('Password updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <PageHead
        title="Account"
        summary={<>{user?.email} <span className={`role-badge role-${user?.role}`}>{user?.role === 'admin' ? 'Admin' : 'Sales'}</span></>}
      />
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
        <button className="btn fit" disabled={busy || name.trim() === (user?.name || '')} type="submit">Save name</button>
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
          <small>At least 8 characters.</small>
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
          {confirmPassword && confirmPassword !== newPassword && <small className="warn-text">Does not match yet.</small>}
        </label>
        <button className="btn fit" disabled={busy} type="submit">Update password</button>
      </form>
    </div>
  );
}
