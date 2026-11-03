import { useEffect } from 'react';
import { Route, Routes } from 'react-router';
import './admin.css';
import { Loading } from '../components/ui.jsx';
import { SessionProvider, useSession } from './session.jsx';
import { MetaProvider } from './meta.jsx';
import AdminLayout from './AdminLayout.jsx';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ResourceList from './pages/ResourceList.jsx';
import ResourceForm from './pages/ResourceForm.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import Users from './pages/Users.jsx';
import Inbox from './pages/Inbox.jsx';
import Audit from './pages/Audit.jsx';

function SuperOnly({ children }) {
  const { isSuper } = useSession();
  return isSuper ? children : <p className="adm-page alert alert--error">403</p>;
}

function Gate() {
  const s = useSession();
  if (s.status === 'loading') return <Loading />;
  if (s.status === 'out') return <Login />;
  if (s.user.mustChangePassword) return <ChangePassword forced />;
  return (
    <MetaProvider>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="content/:resource" element={<ResourceList />} />
          <Route path="content/:resource/new" element={<ResourceForm />} />
          <Route path="content/:resource/:id" element={<ResourceForm />} />
          <Route path="password" element={<ChangePassword />} />
          <Route path="inbox" element={<SuperOnly><Inbox /></SuperOnly>} />
          <Route path="settings" element={<SuperOnly><SettingsPage /></SuperOnly>} />
          <Route path="users" element={<SuperOnly><Users /></SuperOnly>} />
          <Route path="audit" element={<SuperOnly><Audit /></SuperOnly>} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </MetaProvider>
  );
}

export default function AdminApp() {
  useEffect(() => {
    // The admin area must never show up in search results.
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex, nofollow';
    document.head.appendChild(tag);
    document.title = 'Admin';
    return () => tag.remove();
  }, []);
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}
