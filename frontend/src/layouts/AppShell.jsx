import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Icon from '../components/Icon';
import { Lockup } from '../components/Misc';
import { useSite } from '../auth/SiteContext';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../utils/format';
import TextSizeToggle from './TextSizeToggle';

/**
 * Shared shell for investor app and staff console.
 * nav: [{ to, label, icon, end?, section? }]
 * tabs: up to 4 items for the mobile bottom tab bar (+ "More" opens full menu)
 */
export default function AppShell({ nav, tabs, home, topExtra, children, label }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const loc = useLocation();
  const { user, signOut } = useAuth();
  const { site } = useSite();
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  const links = (
    <ul>
      {nav.map((n) =>
        n.section ? (
          <li key={`s-${n.section}`} className="side-section" aria-hidden="true">
            {n.section}
          </li>
        ) : (
          <li key={n.to}>
            <NavLink to={n.to} end={n.end} className="side-link">
              <Icon name={n.icon} size={20} />
              <span>{n.label}</span>
            </NavLink>
          </li>
        ),
      )}
      <li>
        <button type="button" className="side-link" style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => signOut('You have been logged out securely.')}>
          <Icon name="logout" size={20} />
          <span>Log out</span>
        </button>
      </li>
    </ul>
  );

  return (
    <div className="shell has-tabbar">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="shell__top on-navy">
        <div className="shell__topbar">
          <button type="button" className="icon-btn shell__menu-btn" aria-expanded={menuOpen} aria-controls="shell-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((o) => !o)}>
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <Lockup tone="gold" to={home} compact />
          <div className="spacer" />
          {topExtra}
          <span className="hide-sm">
            <TextSizeToggle />
          </span>
          <span className="hide-sm small" style={{ color: 'var(--on-navy-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user?.name}>
            {user?.name}
          </span>
        </div>
        {menuOpen && (
          <nav id="shell-menu" className="mobile-menu-panel" aria-label={`${label} menu`}>
            {links}
            <div style={{ padding: '0.75rem 0.85rem' }}>
              <TextSizeToggle />
            </div>
          </nav>
        )}
      </header>
      <div className="shell__body">
        <nav className="shell__side on-navy" aria-label={label}>
          {links}
        </nav>
        <main id="main" className="shell__main" tabIndex={-1}>
          <div className="shell__content">{children}</div>
          <footer className="shell__footer">
            <p>
              {site.firmName || 'Aureus Finserve'} — AMFI-registered Mutual Fund Distributor
              {site.arn && (
                <>
                  {' '}
                  · ARN-{String(site.arn).replace(/^ARN-?/i, '')}
                  {site.arnValidTill && <> (valid till {formatDate(site.arnValidTill)})</>}
                </>
              )}
              . We are a mutual fund distributor and do not provide investment advice.
            </p>
            <p>
              <strong>Mutual fund investments are subject to market risks, read all scheme related documents carefully.</strong>
            </p>
            <p>
              <NavLink to="/legal/privacy">Privacy</NavLink> · <NavLink to="/legal/terms">Terms</NavLink> ·{' '}
              <NavLink to="/legal/commission">Commission disclosure</NavLink>
            </p>
          </footer>
        </main>
      </div>
      {tabs && (
        <nav className="tabbar" aria-label={`${label} quick links`}>
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}>
              <Icon name={t.icon} size={22} />
              <span>{t.label}</span>
            </NavLink>
          ))}
          <button type="button" onClick={() => setMenuOpen(true)} aria-controls="shell-menu" aria-expanded={menuOpen}>
            <Icon name="menu" size={22} />
            <span>More</span>
          </button>
        </nav>
      )}
    </div>
  );
}
