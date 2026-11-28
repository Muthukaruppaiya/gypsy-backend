import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/* ---------- Toasts ---------- */

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message, { tone = 'ok', action, timeout = 4000 } = {}) => {
    seq.current += 1;
    const id = seq.current;
    setToasts((list) => [...list.slice(-2), { id, message, tone, action }]);
    if (timeout) setTimeout(() => dismiss(id), timeout);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span>{toast.message}</span>
            {toast.action && (
              <Link to={toast.action.to} onClick={() => dismiss(toast.id)}>{toast.action.label}</Link>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ---------- Two-step confirm for destructive actions ---------- */

export function ConfirmButton({ onConfirm, children, confirmLabel = 'Confirm', className = 'text-btn danger-text', disabled }) {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return undefined;
    const timer = setTimeout(() => setAsking(false), 5000);
    return () => clearTimeout(timer);
  }, [asking]);

  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)} disabled={disabled}>
        {children}
      </button>
    );
  }
  return (
    <span className="confirm-inline">
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="text-btn muted-text" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  );
}

/* ---------- Empty state ---------- */

export function Empty({ children, action }) {
  return (
    <div className="empty-state">
      <p>{children}</p>
      {action}
    </div>
  );
}

/* ---------- Loading ---------- */

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/* ---------- Page title ---------- */

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Gypsy Desk` : 'Gypsy Desk';
  }, [title]);
}

export function statusKey(status) {
  if (status === 'Live') return 'live';
  if (status === 'Under Development') return 'dev';
  return 'talk';
}

/* ---------- Icons ---------- */

const ICONS = {
  desk: 'M4 5h16v11H4zM8 20h8M12 16v4',
  projects: 'M6 4h8l4 4v12H6zM14 4v4h4M8 12h8M8 16h5',
  leads: 'M8 3h8a2 2 0 0 1 2 2v2H6V5a2 2 0 0 1 2-2zM6 7h12v3a6 6 0 0 1-12 0zM9 19h6',
  servers: 'M4 6h16v4H4zM4 14h16v4H4zM7 8h.01M7 16h.01',
  timeline: 'M5 4v16M5 8h9M5 13h13M5 18h7',
  payments: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  auto: 'M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1L7 17M17 7l2.1-2.1',
  account: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20a7 7 0 0 1 14 0',
  team: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19a6 6 0 0 1 12 0M16 11a2.5 2.5 0 1 0 0-5M17 14a5 5 0 0 1 4 5',
  phone: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 7h16M4 12h16M4 17h16',
  chat: 'M4 20l1.5-4A8 8 0 1 1 8 19z',
  money: 'M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4M18 10v4',
  alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  check: 'M5 12l5 5L20 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  wrench: 'M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 1-2-2z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3M12 15v2',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.3 2 12 2 12s3.5 6 10 6a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
};

export function Icon({ name, className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`icon${className ? ` ${className}` : ''}`}>
      <path d={ICONS[name] || ''} />
    </svg>
  );
}

/* ---------- Page header: one layout for every page ---------- */

export function PageHead({ crumbs, title, summary, meta, children }) {
  return (
    <header className="page-head">
      <div className="page-head-main">
        {crumbs && (
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => (
              <span key={crumb.label}>
                {crumb.to
                  ? <Link className="crumb" to={crumb.to} onClick={crumb.onClick}>{crumb.label}</Link>
                  : <span aria-current="page">{crumb.label}</span>}
                {index < crumbs.length - 1 && <span className="crumb-sep" aria-hidden="true">/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {summary && <p className="head-summary-line">{summary}</p>}
        {meta}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </header>
  );
}

export function BrandMark({ size = 40, className = '' }) {
  return (
    <span className={`brand-mark ${className}`} style={{ width: size, height: size }}>
      <img src="/brand/logo-mark-96.png" srcSet="/brand/logo-mark-96.png 1x, /brand/logo-mark.png 3x" alt="" width={size} height={size} />
    </span>
  );
}
