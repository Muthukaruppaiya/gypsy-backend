import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectForm from './pages/ProjectForm';
import Payments from './pages/Payments';
import ServerLog from './pages/ServerLog';
import Timeline from './pages/Timeline';
import FollowUps from './pages/FollowUps';
import LeadForm from './pages/LeadForm';
import Automation from './pages/Automation';
import Account from './pages/Account';
import Team from './pages/Team';

function Boot() {
  return (
    <div className="boot">
      <span className="spinner" aria-hidden="true" />
      Opening the desk…
    </div>
  );
}

function safeNext(raw) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

function Protected() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Boot />;
  if (!user) {
    const next = location.pathname + location.search;
    const target = next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login';
    return <Navigate to={target} replace />;
  }
  return <Layout />;
}

// Pages only an admin may open. Sales is sent back to the desk.
function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function Guest({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Boot />;
  if (user) return <Navigate to={safeNext(new URLSearchParams(location.search).get('next'))} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Guest><Login mode="login" /></Guest>} />
      <Route path="/register" element={<Guest><Login mode="register" /></Guest>} />
      <Route element={<Protected />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/leads" element={<Navigate to="/leads/due" replace />} />
        <Route path="/leads/new" element={<LeadForm />} />
        <Route path="/leads/:id/edit" element={<LeadForm />} />
        <Route path="/leads/:view" element={<FollowUps />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<ProjectForm />} />
        <Route path="/projects/:id" element={<ProjectForm />} />
        <Route path="/payments" element={<AdminOnly><Payments /></AdminOnly>} />
        <Route path="/servers" element={<AdminOnly><ServerLog /></AdminOnly>} />
        <Route path="/timeline" element={<AdminOnly><Timeline /></AdminOnly>} />
        <Route path="/automation" element={<AdminOnly><Automation /></AdminOnly>} />
        <Route path="/team" element={<AdminOnly><Team /></AdminOnly>} />
        <Route path="/account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
