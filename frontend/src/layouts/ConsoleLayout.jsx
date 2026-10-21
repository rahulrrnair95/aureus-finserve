import { Outlet } from 'react-router-dom';
import AppShell from './AppShell';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/console', label: 'Dashboard', icon: 'chart', end: true },
  { to: '/console/clients', label: 'Clients', icon: 'users' },
  { to: '/console/leads', label: 'Leads', icon: 'inbox' },
  { to: '/console/kyc', label: 'KYC requests', icon: 'shield' },
  { to: '/console/orders', label: 'Order desk', icon: 'cart' },
  { to: '/console/tickets', label: 'Service tickets', icon: 'ticket' },
  { to: '/console/nfos', label: 'NFOs', icon: 'briefcase', rmOnly: true }, // read-only for RMs
  { section: 'Administration', admin: true },
  { to: '/console/brokerage', label: 'Brokerage', icon: 'rupee', admin: true },
  { to: '/console/content', label: 'Content', icon: 'book', admin: true },
  { to: '/console/users', label: 'Users', icon: 'shield', admin: true },
  { to: '/console/audit', label: 'Audit log', icon: 'list', admin: true },
  { to: '/console/nfos', label: 'NFOs', icon: 'briefcase', admin: true },
  { to: '/console/sync', label: 'Data sync', icon: 'sync', admin: true },
  { section: 'Account' },
  { to: '/console/settings', label: 'Settings', icon: 'settings' },
];

const TABS = [
  { to: '/console', label: 'Dashboard', icon: 'chart', end: true },
  { to: '/console/clients', label: 'Clients', icon: 'users' },
  { to: '/console/leads', label: 'Leads', icon: 'inbox' },
  { to: '/console/orders', label: 'Orders', icon: 'cart' },
];

export default function ConsoleLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const nav = NAV.filter((n) => (!n.admin || isAdmin) && (!n.rmOnly || !isAdmin));
  return (
    <AppShell nav={nav} tabs={TABS} home="/console" label="Staff console" topExtra={<span className="chip chip--navy">{user?.role}</span>}>
      <Outlet />
    </AppShell>
  );
}
