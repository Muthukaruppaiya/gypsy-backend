import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('muthu@gypsycoder.local');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState(undefined);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    setError('');
    setPassword('');
    if (!isRegister) setEmail('muthu@gypsycoder.local');
  }, [location.pathname, isRegister]);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isRegister) await register(name, email, password);
      else await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <section className="login-story">
        <div>
          <p className="brand-kicker light">Gypsy Coder</p>
          <h1>Gypsy Desk</h1>
        </div>
        <p className="fine">
          {health === undefined && 'Checking the API…'}
          {health === null && 'API is not running. Start it with npm run dev.'}
          {health && health.database}
        </p>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={onSubmit}>
          <p className="kicker">{isRegister ? 'New account' : 'Studio sign in'}</p>
          <h2>{isRegister ? 'Create your login' : 'Open the desk'}</h2>
          {error && <p className="banner">{error}</p>}
          {isRegister && (
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="inline-field">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
              />
              <button type="button" className="btn secondary" onClick={() => setShow((value) => !value)}>
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          <button className="btn wide" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
          {isRegister ? (
            <p className="switch">Already have an account? <Link to="/login">Sign in</Link></p>
          ) : (
            <p className="switch"><Link to="/register">Create an account</Link></p>
          )}
        </form>
      </section>
    </div>
  );
}
