import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import AppShell from './AppShell';
import Icon from '../components/Icon';
import { investorApi } from '../api/endpoints';

const NAV = [
  { to: '/app', label: 'Overview', icon: 'home', end: true },
  { to: '/app/holdings', label: 'Holdings', icon: 'pie' },
  { to: '/app/sips', label: 'SIPs', icon: 'repeat' },
  { to: '/app/transact', label: 'Invest / Transact', icon: 'cart' },
  { to: '/app/orders', label: 'Orders', icon: 'list' },
  { to: '/app/reports', label: 'Reports', icon: 'file' },
  { to: '/app/goals', label: 'Goals', icon: 'target' },
  { section: 'Account' },
  { to: '/app/profile', label: 'Profile', icon: 'user' },
  { to: '/app/service', label: 'Service requests', icon: 'ticket' },
  { to: '/app/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/app/rm', label: 'Contact my RM', icon: 'phone' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
];

const TABS = [
  { to: '/app', label: 'Overview', icon: 'home', end: true },
  { to: '/app/holdings', label: 'Holdings', icon: 'pie' },
  { to: '/app/transact', label: 'Invest', icon: 'cart' },
  { to: '/app/orders', label: 'Orders', icon: 'list' },
];

const InvestorContext = createContext(null);
const MEMBER_KEY = 'af.member';

/**
 * useInvestor() → { member, setMember, family, memberParam, unread, refreshUnread }
 * member: 'self' | 'all' | '<investorId>' ; memberParam: value to pass to API (undefined for self).
 */
export function useInvestor() {
  return useContext(InvestorContext);
}

export default function InvestorLayout() {
  const [family, setFamily] = useState([]);
  const [member, setMemberState] = useState(() => {
    try {
      return sessionStorage.getItem(MEMBER_KEY) || 'self';
    } catch {
      return 'self';
    }
  });
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    investorApi
      .family()
      .then((f) => setFamily(Array.isArray(f) ? f : []))
      .catch(() => setFamily([]));
  }, []);

  const refreshUnread = useCallback(() => {
    investorApi
      .notifications()
      .then((ns) => setUnread((ns || []).filter((n) => !n.read).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    return () => clearInterval(t);
  }, [refreshUnread]);

  const setMember = useCallback((m) => {
    setMemberState(m);
    try {
      sessionStorage.setItem(MEMBER_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => {
    const self = family[0];
    const memberParam = member === 'self' || (self && String(self.id) === String(member)) ? undefined : member;
    const memberName = member === 'all' ? 'All family' : member === 'self' ? self?.name || 'Self' : family.find((f) => String(f.id) === String(member))?.name || 'Self';
    return { member, setMember, family, memberParam, memberName, unread, refreshUnread };
  }, [member, setMember, family, unread, refreshUnread]);

  return (
    <InvestorContext.Provider value={value}>
      <AppShell nav={NAV} tabs={TABS} home="/app" label="Investor" topExtra={<TopExtra />}>
        <Outlet />
      </AppShell>
    </InvestorContext.Provider>
  );
}

function TopExtra() {
  const { family, member, setMember, unread } = useInvestor();
  const id = useId();
  return (
    <>
      {family.length > 1 && (
        <div className="member-switch">
          <label htmlFor={id} className="sr-only">
            View portfolio of
          </label>
          <select id={id} className="select" value={member} onChange={(e) => setMember(e.target.value)}>
            <option value="self">Self</option>
            {family.slice(1).map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.name} ({f.relation?.toLowerCase()})
              </option>
            ))}
            <option value="all">All family</option>
          </select>
        </div>
      )}
      <Link to="/app/notifications" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} style={{ color: 'var(--on-navy)' }}>
        <Icon name="bell" />
        {unread > 0 && (
          <span className="badge-count" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>
    </>
  );
}
