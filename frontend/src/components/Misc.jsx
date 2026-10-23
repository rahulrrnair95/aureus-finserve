import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import Button from './Button';
import { brand } from '../brand';

/**
 * Brand lockup: monogram image + "AUREUS" serif + "FINSERVE" spaced sans. tone: 'gold' (navy bg) | 'navy' (light bg)
 * With a tagline it is stacked and centred like the full logo: mark, AUREUS, FINSERVE, a short rule, the tagline.
 */
export function Lockup({ tone = 'gold', to = '/', compact = false, tagline }) {
  return (
    <Link
      to={to}
      className={`lockup lockup--${tone} ${compact ? 'lockup--compact' : ''} ${tagline ? 'lockup--stacked' : ''}`}
      aria-label="Aureus Finserve — home"
    >
      <img src={brand.mark[tone] || brand.markGold} alt="" className="lockup__mark" width="52" height="42" />
      <span className="lockup__text" aria-hidden="true">
        <span className="lockup__name">AUREUS</span>
        <span className="lockup__sub">FINSERVE</span>
        {tagline && (
          <>
            <span className="lockup__rule" />
            <span className="lockup__tagline">{tagline}</span>
          </>
        )}
      </span>
    </Link>
  );
}

export function SectionHeading({ eyebrow, title, lead, center = false, as: H = 'h2' }) {
  return (
    <div className={center ? 'center' : undefined} style={{ marginBottom: '2rem' }}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <H>{title}</H>
      <span className={`gold-rule ${center ? 'gold-rule--center' : ''}`} aria-hidden="true" />
      {lead && <p className="lead" style={center ? { margin: '0 auto' } : undefined}>{lead}</p>}
    </div>
  );
}

export function PageHead({ eyebrow, title, lead, children }) {
  return (
    <header className="page-head on-navy">
      <div className="container">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <span className="gold-rule" aria-hidden="true" />
        {lead && <p className="lead">{lead}</p>}
        {children}
      </div>
    </header>
  );
}

export function Accordion({ items }) {
  const [open, setOpen] = useState(null);
  const base = useId();
  return (
    <div className="accordion">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div className="accordion__item" key={it.id ?? i}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '1rem' }}>
              <button type="button" className="accordion__btn" aria-expanded={isOpen} aria-controls={`${base}-p${i}`} id={`${base}-b${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                <span>{it.title}</span>
                <span className="accordion__icon">
                  <Icon name="plus" />
                </span>
              </button>
            </h3>
            <div id={`${base}-p${i}`} role="region" aria-labelledby={`${base}-b${i}`} className="accordion__panel" hidden={!isOpen}>
              {it.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Pagination({ page, size, total, onChange }) {
  const pages = Math.max(1, Math.ceil((total || 0) / size));
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span className="small" aria-live="polite">
        Page {page + 1} of {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

export function ProgressBar({ value, label }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
      <div className="progress__bar" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Countdown hook for OTP resend */
export function useCountdown(seconds, deps = []) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft((l) => (l <= 1 ? (clearInterval(t), 0) : l - 1)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return left;
}

export function StandardDisclaimer({ compact = false }) {
  return (
    <p className={`disclaimer-box ${compact ? 'tiny' : 'small'}`} style={{ margin: 0 }}>
      <strong>Mutual fund investments are subject to market risks, read all scheme related documents carefully.</strong> Aureus Finserve is an AMFI-registered mutual fund
      distributor and does not provide investment advice. Past performance may or may not be sustained in future.
    </p>
  );
}

export function ExtLink({ href, children, className }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}
