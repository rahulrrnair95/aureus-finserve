import { Link } from 'react-router-dom';
import { useSite } from '../auth/SiteContext';
import { formatDate } from '../utils/format';
import { brand } from '../brand';

/** Split layout: navy brand panel with full gold logo + form panel. */
export default function AuthLayout({ children }) {
  const { site } = useSite();
  return (
    <div className="auth">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <aside className="auth__brand on-navy" aria-label="Aureus Finserve">
        <Link to="/" aria-label="Aureus Finserve — back to home">
          <img src={brand.fullGold} alt="Aureus Finserve — Wealth Beyond Today" className="auth__logo" width="290" height="258" />
        </Link>
        <div className="auth__brand-copy">
          <span className="gold-rule gold-rule--center" aria-hidden="true" />
          <p>Your family’s mutual fund investments, statements and SIPs — in one secure place, with a dedicated relationship manager.</p>
        </div>
      </aside>
      <div className="auth__panel">
        <main id="main" tabIndex={-1} className="auth__form">
          {children}
          <nav className="auth__links" aria-label="Help">
            <Link to="/contact">New investor? Contact us</Link>
            <Link to="/legal/privacy">Privacy policy</Link>
            <Link to="/">Back to website</Link>
          </nav>
        </main>
        <footer className="auth__foot">
          <p style={{ margin: '0 0 0.35rem' }}>
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
          <p style={{ margin: 0 }}>
            <strong>Mutual fund investments are subject to market risks, read all scheme related documents carefully.</strong>
          </p>
        </footer>
      </div>
    </div>
  );
}
