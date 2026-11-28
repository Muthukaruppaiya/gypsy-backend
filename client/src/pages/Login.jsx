import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandMark, Icon, usePageTitle } from '../components/ui';
import { useAuth } from '../auth';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Decorative preview of the desk for the brand panel. Not real data.
function DeskPreview() {
  return (
    <div className="login-preview" aria-hidden="true">
      <div className="lp-card lp-main">
        <span className="lp-label">Still to collect</span>
        <strong>₹2,40,000</strong>
        <span className="lp-meter"><span style={{ width: '64%' }} /></span>
      </div>
      <div className="lp-row">
        <div className="lp-card lp-chip"><Icon name="phone" /><span><b>3</b> calls due</span></div>
        <div className="lp-card lp-chip"><Icon name="servers" /><span><b>12</b> live</span></div>
      </div>
      <div className="lp-card lp-list">
        <span><i className="lp-dot hot" />Call back · 10:30 am</span>
        <span><i className="lp-dot" />Server renewal · Friday</span>
        <span><i className="lp-dot ok" />Payment logged</span>
      </div>
    </div>
  );
}

export default function Login({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const rawNext = params.get('next') || '/';
  // Only follow same-app paths, never an outside URL.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  usePageTitle(isRegister ? 'Set up' : 'Sign in');
  const [name, setName] = useState('');
  const [remembered, setRemembered] = useState(() => localStorage.getItem('gypsy-last-email') || '');
  const [email, setEmail] = useState(remembered);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const passwordRef = useRef(null);
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
    if (!isRegister) {
      const saved = localStorage.getItem('gypsy-last-email') || '';
      setRemembered(saved);
      setEmail(saved);
    }
  }, [location.pathname, isRegister]);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isRegister) await register(name, email, password);
      else await login(email, password);
      localStorage.setItem('gypsy-last-email', email.trim().toLowerCase());
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      // Put the cursor back in the password box, ready to retype.
      setTimeout(() => passwordRef.current?.select(), 0);
    } finally {
      setBusy(false);
    }
  }

  function trackCaps(event) {
    if (typeof event.getModifierState === 'function') setCaps(event.getModifierState('CapsLock'));
  }

  const closed = isRegister && health && !health.needsSetup;
  const returning = !isRegister && Boolean(remembered) && email === remembered;

  function forget() {
    localStorage.removeItem('gypsy-last-email');
    setRemembered('');
    setEmail('');
    setPassword('');
    setError('');
  }

  return (
    <div className="login-shell">
      <section className="login-story">
        <div className="login-brand">
          <BrandMark size={52} className="on-dark" />
          <div>
            <p className="brand-kicker light">Gypsy Coder</p>
            <strong>Gypsy Desk</strong>
          </div>
        </div>
        <div className="login-pitch">
          <h1>Projects, calls, and money in one place.</h1>
          <DeskPreview />
        </div>
      </section>

      <section className="login-panel">
        <form className={`login-card${shake ? ' shake' : ''}`} onSubmit={onSubmit}>
          <img className="login-logo" src="/brand/logo-full.png" alt="Gypsy Coder" width="720" height="611" />

          <div className="login-head">
            <h2>{isRegister ? 'Set up the desk' : returning ? `${greeting()}` : 'Welcome back'}</h2>
            {returning && (
              <p className="login-who">
                <span className="login-avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</span>
                <span className="login-email">{email}</span>
                <button type="button" className="text-btn" onClick={forget}>Not you?</button>
              </p>
            )}
          </div>

          {health === null && (
            <p className="banner" role="alert">Cannot reach the server. Start it with npm run dev.</p>
          )}
          {closed && <p className="banner" role="alert">Sign-up is closed. Ask an admin for a login.</p>}
          {error && <p className="banner" role="alert">{error}</p>}

          {isRegister && (
            <label className="login-field">
              <span className="sr">Name</span>
              <Icon name="user" />
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Your name"
                required
                autoFocus
              />
            </label>
          )}

          <label className={returning ? 'sr' : 'login-field'}>
            <span className="sr">Email</span>
            <Icon name="mail" />
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="Email"
              autoFocus={!isRegister && !returning}
              tabIndex={returning ? -1 : undefined}
              required
            />
          </label>

          <label className="login-field">
            <span className="sr">Password</span>
            <Icon name="lock" />
            <input
              ref={passwordRef}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={trackCaps}
              onKeyUp={trackCaps}
              onBlur={() => setCaps(false)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder="Password"
              minLength={isRegister ? 8 : undefined}
              autoFocus={returning}
              required
            />
            <button
              type="button"
              className="login-eye"
              onClick={() => setShow((value) => !value)}
              aria-label={show ? 'Hide password' : 'Show password'}
              aria-pressed={show}
            >
              <Icon name={show ? 'eyeOff' : 'eye'} />
            </button>
          </label>
          {caps && <p className="caps-warn" role="status">Caps Lock is on</p>}

          <button className="btn wide login-submit" type="submit" disabled={busy || closed || health === null}>
            {busy && <span className="spinner on-btn" aria-hidden="true" />}
            {busy ? 'Signing in…' : isRegister ? 'Create account' : 'Sign in'}
          </button>

          {isRegister && <Link className="login-switch" to="/login">Back to sign in</Link>}
          {!isRegister && health?.needsSetup && <Link className="login-switch" to="/register">Set up the desk</Link>}
        </form>
      </section>
    </div>
  );
}
