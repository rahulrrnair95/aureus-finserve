import { useState } from 'react';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { useToast } from '../../../components/Toast';
import { friendlyError } from '../../../api/client';

export const TXN_TYPES = ['PURCHASE', 'SIP', 'REDEMPTION', 'SWITCH_IN', 'SWITCH_OUT', 'STP_IN', 'STP_OUT', 'SWP'];
export const ORDER_STATUSES = ['PENDING_APPROVAL', 'PLACED', 'PAYMENT_RECEIVED', 'ALLOTTED', 'FAILED', 'CANCELLED'];
export const ORDER_TYPES = ['LUMPSUM', 'SIP', 'REDEEM', 'SWITCH', 'STP', 'SWP'];
export const TICKET_CATEGORIES = ['ADDRESS_CHANGE', 'BANK_CHANGE', 'NOMINEE_CHANGE', 'MISSING_TRANSACTION', 'STATEMENT', 'OTHER'];

const TXN_LABEL = {
  PURCHASE: 'Purchase',
  SIP: 'SIP instalment',
  REDEMPTION: 'Redemption',
  SWITCH_IN: 'Switch in',
  SWITCH_OUT: 'Switch out',
  STP_IN: 'STP in',
  STP_OUT: 'STP out',
  SWP: 'SWP withdrawal',
};
export const txnLabel = (t) => TXN_LABEL[t] || t;

const ORDER_TYPE_LABEL = { LUMPSUM: 'Lump sum', SIP: 'SIP', REDEEM: 'Redemption', SWITCH: 'Switch', STP: 'STP', SWP: 'SWP' };
export const orderTypeLabel = (t) => ORDER_TYPE_LABEL[t] || t;

const CATEGORY_LABEL = {
  ADDRESS_CHANGE: 'Address change',
  BANK_CHANGE: 'Bank account change',
  NOMINEE_CHANGE: 'Nominee change',
  MISSING_TRANSACTION: 'Missing transaction',
  STATEMENT: 'Statement request',
  OTHER: 'Other',
};
export const categoryLabel = (c) => CATEGORY_LABEL[c] || c;

/** Page header used across the investor area. */
export function PageTitle({ eyebrow, title, children }) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {children && <div className="row inv-actions">{children}</div>}
    </div>
  );
}

/** Toggle-button filter chips. options: [{ value, label, count }] */
export function FilterChips({ options, value, onChange, label }) {
  return (
    <div className="inv-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="inv-chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="inv-chip__count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Download button: shows loading, reports errors via toast. */
export function DownloadButton({ onDownload, children, variant = 'outline', size = 'sm' }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const run = async () => {
    setBusy(true);
    try {
      await onDownload();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant={variant} size={size} onClick={run} loading={busy}>
      {!busy && <Icon name="download" size={16} />}
      {children}
    </Button>
  );
}

/** wa.me link: digits only, prefix 91 for 10-digit Indian numbers. */
export function waLink(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
}

export function telLink(phone) {
  const d = String(phone || '').replace(/[^\d+]/g, '');
  return d ? `tel:${d}` : null;
}

/** Definition list of label/value pairs. */
export function InfoList({ items }) {
  return (
    <dl className="inv-dl">
      {items
        .filter(Boolean)
        .map((it) => (
          <div key={it.label} className="inv-dl__row">
            <dt>{it.label}</dt>
            <dd>{it.value ?? '—'}</dd>
          </div>
        ))}
    </dl>
  );
}
