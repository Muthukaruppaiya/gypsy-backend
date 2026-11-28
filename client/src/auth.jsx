import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setReady(true);
      return;
    }
    api('/api/auth/me')
      .then(setUser)
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    function refresh() {
      if (!localStorage.getItem('token')) return;
      api('/api/auth/me').then(setUser).catch(() => {});
    }
    function onVisible() {
      if (document.visibilityState === 'visible') refresh();
    }
    window.addEventListener('gypsy-auth-refresh', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('gypsy-auth-refresh', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    isAdmin: user?.role === 'admin',
    async login(email, password) {
      const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      localStorage.setItem('token', data.token);
      setUser(data.user);
    },
    async register(name, email, password) {
      const data = await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
      localStorage.setItem('token', data.token);
      setUser(data.user);
    },
    logout() {
      localStorage.removeItem('token');
      setUser(null);
    },
    setUser,
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
