import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectForm from './pages/ProjectForm';
import Payments from './pages/Payments';
import ServerLog from './pages/ServerLog';
import Timeline from './pages/Timeline';
import Leads from './pages/Leads';
import Automation from './pages/Automation';
import Account from './pages/Account';

function Boot() {
  return <div className="boot">Opening the desk…</div>;
}

function Protected() {
  const { user, ready } = useAuth();
  if (!ready) return <Boot />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function Guest({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Boot />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Guest><Login mode="login" /></Guest>} />
      <Route path="/register" element={<Guest><Login mode="register" /></Guest>} />
      <Route element={<Protected />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<ProjectForm />} />
        <Route path="/projects/:id" element={<ProjectForm />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/servers" element={<ServerLog />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="/account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
