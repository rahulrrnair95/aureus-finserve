// Shared pieces of the public NFO pages (list, detail, home band).
import { Link } from 'react-router-dom';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { RiskBadge } from '../../../components/RiskOMeter';
import { useToast } from '../../../components/Toast';
import { publicApi } from '../../../api/endpoints';
import { friendlyError } from '../../../api/client';
import { formatDate, formatINR } from '../../../utils/format';
import { initials } from './content';
import { useState } from 'react';

export const NFO_DISCLAIMER = 'NFOs have no performance history. Read the scheme information document before investing.';

export const NFO_CATEGORIES = [
  { value: 'EQUITY', label: 'Equity' },
  { value: 'DEBT', label: 'Debt' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'OTHER', label: 'Other (ETF, FoF, FMP…)' },
];
export const nfoCategoryLabel = (v) => ({ EQUITY: 'Equity', DEBT: 'Debt', HYBRID: 'Hybrid', OTHER: 'Other' })[v] || v;

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** "Closes in 3 days" / "Closes today" / "Opens on 22 Oct 2026" / "Closed". */
export function nfoStatusText(n) {
  if (n.status === 'UPCOMING') return `Opens on ${formatDate(n.openDate)}`;
  if (n.status === 'OPEN') {
    if (n.daysLeft === 0) return n.closeDateConfirmed ? 'Closes today' : 'Closes today at the latest';
    if (n.daysLeft === 1) return n.closeDateConfirmed ? 'Closes tomorrow' : 'Closes by tomorrow';
    return n.closeDateConfirmed ? `Closes in ${plural(n.daysLeft, 'day')}` : `Closes within ${plural(n.daysLeft, 'day')}`;
  }
  return `Closed${n.closesBy ? ` on ${formatDate(n.closeDate || n.closesBy)}` : ''}`;
}

const TONE = { OPEN: 'success', UPCOMING: 'info', CLOSED: '' };
const STATUS_WORD = { OPEN: 'Open now', UPCOMING: 'Upcoming', CLOSED: 'Closed' };

export function NfoStatusBadge({ nfo }) {
  return (
    <span className={`chip ${TONE[nfo.status] ? `chip--${TONE[nfo.status]}` : ''}`}>
      {STATUS_WORD[nfo.status] || nfo.status}
    </span>
  );
}

/** Close date, or "On or before …" with the SEBI note when the AMC has not published it yet. */
export function NfoCloseDate({ nfo }) {
  if (nfo.closeDateConfirmed) return <>{formatDate(nfo.closeDate)}</>;
  const elss = /elss/i.test(nfo.subCategory || '');
  return (
    <>
      On or before {formatDate(nfo.closesBy)} <span className="tiny muted nowrap">{elss ? '(estimated)' : '(max 15 days)'}</span>
    </>
  );
}

export function nfoMinimum(n) {
  if (n.minAmount != null && Number(n.minAmount) > 0) return formatINR(n.minAmount, { decimals: 0 });
  return n.minAmountText || '—';
}

export const nfoContactUrl = (n) => `/contact?interest=OTHER&message=${encodeURIComponent(`I'm interested in the NFO: ${n.schemeName}`)}`;

/** AMC logo when the AMC is one of our partners (/public/amcs), else a text tile with initials. */
export function NfoAmcMark({ amc, amcs }) {
  const partner = (amcs || []).find((a) => a.name === amc);
  if (partner?.logoUrl) {
    return (
      <span className="pub-nfo__logo">
        <img src={partner.logoUrl} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className="pub-nfo__logo pub-nfo__logo--text" aria-hidden="true">
      {initials(amc)}
    </span>
  );
}

export function OnePagerButton({ nfo, variant = 'ghost', size = 'sm', label = 'Download one-pager' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!nfo.hasOnePager) return null;
  return (
    <Button
      variant={variant}
      size={size}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await publicApi.nfoOnePager(nfo.id);
        } catch (err) {
          toast.error(friendlyError(err));
        } finally {
          setBusy(false);
        }
      }}
      aria-label={`${label} for ${nfo.schemeName} (PDF)`}
    >
      <Icon name="download" size={16} /> {label}
    </Button>
  );
}

export function NfoCard({ nfo, amcs, compact = false }) {
  const titleId = `nfo-${nfo.id}-title`;
  return (
    <article className={`card pub-nfo ${compact ? 'pub-nfo--compact' : ''}`} aria-labelledby={titleId}>
      <div className="pub-nfo__head">
        <NfoAmcMark amc={nfo.amc} amcs={amcs} />
        <div className="pub-nfo__name">
          <span className="pub-nfo__amc">{nfo.amc}</span>
          <h3 id={titleId} className="pub-nfo__title">
            <Link to={`/nfo/${nfo.id}`}>{nfo.schemeName}</Link>
          </h3>
        </div>
      </div>
      <div className="pub-nfo__chips">
        <NfoStatusBadge nfo={nfo} />
        <span className="chip">{nfoCategoryLabel(nfo.assetClass)}</span>
        {nfo.subCategory && <span className="chip">{nfo.subCategory}</span>}
        {nfo.featured && <span className="chip chip--gold">Featured</span>}
      </div>
      <p className={`pub-nfo__when pub-nfo__when--${nfo.status.toLowerCase()}`}>
        <Icon name="clock" size={16} /> {nfoStatusText(nfo)}
      </p>
      <dl className="pub-nfo__facts">
        <div>
          <dt>Opens</dt>
          <dd>{formatDate(nfo.openDate)}</dd>
        </div>
        <div>
          <dt>Closes</dt>
          <dd>
            <NfoCloseDate nfo={nfo} />
          </dd>
        </div>
        {!compact && (
          <div>
            <dt>Minimum investment</dt>
            <dd className="pub-nfo__min">{nfoMinimum(nfo)}</dd>
          </div>
        )}
        {!compact && nfo.riskometer && (
          <div>
            <dt>Risk</dt>
            <dd>
              <RiskBadge risk={nfo.riskometer} />
            </dd>
          </div>
        )}
      </dl>
      <div className="pub-nfo__actions">
        <Button variant="outline" size="sm" to={`/nfo/${nfo.id}`} aria-label={`View details of ${nfo.schemeName}`}>
          View details
        </Button>
        {!compact && <OnePagerButton nfo={nfo} />}
        {nfo.status !== 'CLOSED' && (
          <Button variant="ghost" size="sm" to={nfoContactUrl(nfo)} aria-label={`Talk to us about ${nfo.schemeName}`}>
            Talk to us
          </Button>
        )}
      </div>
    </article>
  );
}
