import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { Lockup, ExtLink } from '../components/Misc';
import { useSite } from '../auth/SiteContext';
import { homeForRole, useAuth } from '../auth/AuthContext';
import { formatDate } from '../utils/format';
import TextSizeToggle from './TextSizeToggle';
import { brand } from '../brand';
import { PhoneLinks, firstPhone, telHref } from '../utils/phone';
import { STATIC_SITE } from '../utils/siteMode';
import StaticDataNote from '../static/StaticDataNote';
import ErrorBoundary from '../components/ErrorBoundary';
import { PageLoader } from '../components/Skeleton';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/funds', label: 'Funds' },
  { to: '/calculators', label: 'Calculators' },
  { to: '/learn', label: 'Learn' },
  { to: '/contact', label: 'Contact' },
];

export const STANDARD_DISCLAIMER = 'Mutual fund investments are subject to market risks, read all scheme related documents carefully.';

export const digits = (v) => String(v || '').replace(/\D/g, '');
export function waLink(num) {
  const d = digits(firstPhone(num) || num);
  if (!d) return null;
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
}
const arnText = (arn) => `ARN-${String(arn).replace(/^ARN-?/i, '')}`;

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const { user } = useAuth();
  const { site } = useSite();
  useEffect(() => {
    setOpen(false);
    if (!loc.hash) window.scrollTo(0, 0);
  }, [loc.pathname, loc.hash]);

  const startTo = STATIC_SITE ? '/contact' : user ? (user.role === 'INVESTOR' ? '/app/transact' : homeForRole(user.role)) : '/contact';

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="site-header on-navy">
        <div className="container">
          <div className="site-header__bar">
            <Lockup tone="gold" />
            <nav className="site-nav" aria-label="Main">
              <ul>
                {NAV.map((n) => (
                  <li key={n.to}>
                    <NavLink to={n.to} end={n.end}>
                      {n.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="header-actions">
              {site.phone && (
                <a href={telHref(firstPhone(site.phone))} className="header-phone" aria-label={`Call us at ${firstPhone(site.phone)}`}>
                  <Icon name="phone" size={18} />
                  <span className="header-phone__num">{firstPhone(site.phone)}</span>
                </a>
              )}
              <span className="hide-sm hide-below-xl">
                <TextSizeToggle />
              </span>
              {STATIC_SITE ? null : user ? (
                <Button variant="outline-gold" size="sm" to={homeForRole(user.role)}>
                  My account
                </Button>
              ) : (
                <Button variant="outline-gold" size="sm" to="/login">
                  Login
                </Button>
              )}
              <Button variant="gold" size="sm" to={startTo} className="hide-sm">
                Start investing
              </Button>
              <button type="button" className="icon-btn nav-toggle" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'}>
                <Icon name={open ? 'close' : 'menu'} />
              </button>
            </div>
          </div>
          {open && (
            <nav id="mobile-nav" className="mobile-nav" aria-label="Main mobile">
              <ul>
                {NAV.map((n) => (
                  <li key={n.to}>
                    <NavLink to={n.to} end={n.end}>
                      {n.label}
                    </NavLink>
                  </li>
                ))}
                <li>
                  <NavLink to="/nfo">New fund offers</NavLink>
                </li>
                <li>
                  <NavLink to="/amc-partners">AMC partners</NavLink>
                </li>
              </ul>
              <div className="row" style={{ marginTop: '1rem' }}>
                <Button variant="gold" size="sm" to={startTo}>
                  Start investing
                </Button>
                <TextSizeToggle />
              </div>
            </nav>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {/* header and footer stay on screen while a page loads; a failed page shows a reload prompt, not a blank screen */}
        <ErrorBoundary key={loc.pathname}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <SiteFooter />
      <FloatingContact site={site} />
    </>
  );
}

/** Floating WhatsApp / call buttons — mobile only (CSS hides ≥ 768px). */
function FloatingContact({ site }) {
  const wa = waLink(site.whatsapp || site.phone);
  if (!wa && !site.phone) return null;
  return (
    <div className="fab-contact" role="group" aria-label="Quick contact">
      {site.phone && (
        <a href={telHref(firstPhone(site.phone))} className="fab-contact__btn fab-contact__btn--call" aria-label={`Call ${site.firmName || 'us'}`}>
          <Icon name="phone" size={22} />
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="fab-contact__btn fab-contact__btn--wa" aria-label="Chat on WhatsApp (opens in new tab)">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.8 11.9 11.9 0 004.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 001.8-1.3 2.3 2.3 0 00.2-1.3c-.1-.1-.3-.2-.5-.3z"
            />
          </svg>
        </a>
      )}
    </div>
  );
}

const SOCIALS = [
  // LinkedIn and YouTube hidden for now (the URLs are placeholders) - uncomment to show them again.
  // { key: 'linkedin', label: 'LinkedIn' },
  // { key: 'youtube', label: 'YouTube' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'x', label: 'X (Twitter)' },
];

export function SiteFooter() {
  const { site } = useSite();
  const socials = SOCIALS.filter((s) => site.socials && site.socials[s.key]);
  return (
    <footer className="site-footer on-navy">
      <div className="container">
        <div className="footer-grid">
          <div>
            <img src={brand.fullGold} alt="Aureus Finserve — Wealth Beyond Today" className="footer-logo" width="160" height="142" />
            {site.address && <p style={{ whiteSpace: 'pre-line' }}>{site.address}</p>}
            {site.phone && (
              <p style={{ margin: 0 }}>
                <PhoneLinks value={site.phone} />
              </p>
            )}
            {site.email && (
              <p>
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </p>
            )}
            {socials.length > 0 && (
              <ul className="footer-socials" aria-label="Social media">
                {socials.map((s) => (
                  <li key={s.key}>
                    <ExtLink href={site.socials[s.key]}>{s.label}</ExtLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2>About the firm</h2>
            <ul>
              <li><Link to="/about">About us</Link></li>
              <li><Link to="/amc-partners">AMC partners</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/legal/disclaimer">Legal &amp; disclosures</Link></li>
            </ul>
            <h2 style={{ marginTop: '1.5rem' }}>Invest</h2>
            <ul>
              <li><Link to="/services">Services</Link></li>
              <li><Link to="/funds">Fund explorer</Link></li>
              <li><Link to="/nfo">New fund offers</Link></li>
              <li><Link to="/services/portfolio-review">Free portfolio review</Link></li>
              {!STATIC_SITE && <li><Link to="/kyc">Complete your KYC online</Link></li>}
            </ul>
          </div>
          <div>
            <h2>Tools &amp; learning</h2>
            <ul>
              <li><Link to="/calculators">Calculators</Link></li>
              <li><Link to="/learn">Knowledge centre</Link></li>
              <li><Link to="/learn?tab=faqs">FAQs</Link></li>
              <li><Link to="/learn?tab=glossary">Glossary</Link></li>
            </ul>
            {!STATIC_SITE && (
              <>
                <h2 style={{ marginTop: '1.5rem' }}>Secure area</h2>
                <ul>
                  <li><Link to="/login">Client &amp; staff login</Link></li>
                </ul>
              </>
            )}
          </div>
          <div>
            <h2>Investor care</h2>
            <ul>
              {!STATIC_SITE && <li><Link to="/kyc/status">Track KYC application</Link></li>}
              <li><ExtLink href={site.scoresUrl || 'https://scores.sebi.gov.in/'}>SEBI SCORES</ExtLink></li>
              <li><Link to="/legal/disclaimer">Disclaimer</Link></li>
              <li><Link to="/legal/privacy">Privacy policy</Link></li>
              <li><Link to="/legal/terms">Terms of use</Link></li>
              <li><Link to="/legal/commission">Commission disclosure</Link></li>
            </ul>
          </div>
        </div>
        <ComplianceBlock site={site} />
      </div>
    </footer>
  );
}

// Only the firm's ARN is shown in the footer (employee EUINs are not listed).
export function ComplianceBlock({ site }) {
  return (
    <div className="footer-compliance">
      <p>
        <strong>{site.firmName || 'Aureus Finserve'}</strong> — AMFI-registered Mutual Fund Distributor
        {site.arn ? (
          <>
            {' '}
            · <strong>{arnText(site.arn)}</strong>
            {site.arnValidTill && <> (valid till {formatDate(site.arnValidTill)})</>}
          </>
        ) : null}
      </p>
      <p>We are a mutual fund distributor and do not provide investment advice.</p>
      <p>
        <strong>{STANDARD_DISCLAIMER}</strong>
      </p>
      <p>
        <Link to="/legal/privacy">Privacy</Link> · <Link to="/legal/terms">Terms</Link>
      </p>
      <p>
        © {new Date().getFullYear()} {site.firmName || 'Aureus Finserve'}. {site.tagline || 'Wealth Beyond Today'}.
      </p>
      {STATIC_SITE && <StaticDataNote />}
    </div>
  );
}
