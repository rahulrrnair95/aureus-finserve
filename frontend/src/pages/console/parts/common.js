// Shared helpers for the staff console pages.
import { useEffect, useState } from 'react';
import { humanize } from '../../../utils/format';

export const KYC_STATUSES = ['VALIDATED', 'REGISTERED', 'ON_HOLD', 'NOT_FOUND'];
export const LOGIN_STATUSES = ['NOT_ACTIVATED', 'ACTIVE', 'LOCKED', 'DISABLED'];
export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'LOST'];
export const ORDER_STATUSES = ['PENDING_APPROVAL', 'PLACED', 'PAYMENT_RECEIVED', 'ALLOTTED', 'FAILED', 'CANCELLED'];
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const RELATIONS = ['SPOUSE', 'CHILD', 'PARENT', 'OTHER', 'SELF'];
export const AUDIT_ACTIONS = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'ACCOUNT_LOCKED',
  'PASSWORD_RESET',
  'PASSWORD_CHANGED',
  'ACCOUNT_ACTIVATED',
  'ORDER_PLACED',
  'ORDER_APPROVED',
  'ORDER_STATUS',
  'SIP_CHANGED',
  'CLIENT_CREATED',
  'CLIENT_UPDATED',
  'LEAD_UPDATED',
  'TICKET_UPDATED',
  'CMS_CHANGED',
  'USER_CREATED',
  'USER_UPDATED',
  'FORCE_LOGOUT',
  'REPORT_EXPORTED',
  'SYNC_RUN',
  'ATTACHMENT_DOWNLOADED',
  'KYC_SUBMITTED',
  'KYC_UPDATED',
  'KYC_DOCUMENT_DOWNLOADED',
  'NFO_UPDATED',
  'NFO_ONEPAGER_UPLOADED',
];
/** Online KYC application statuses (staff queue). */
export const KYC_APP_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'VIPV_SCHEDULED', 'SUBMITTED_TO_KRA', 'KYC_REGISTERED', 'ACTION_REQUIRED', 'REJECTED'];
export const KYC_PENDING_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'VIPV_SCHEDULED', 'ACTION_REQUIRED'];

/** ['A_B'] → [{ value:'A_B', label:'A B' }] */
export const opts = (list) => list.map((v) => ({ value: v, label: humanize(v) }));

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const MOBILE_RE = /^\d{10}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Debounced copy of a value. */
export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Re-run fn every `ms` while the tab is visible. */
export function useInterval(fn, ms) {
  useEffect(() => {
    if (!ms) return undefined;
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') fn();
    }, ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms]);
}

/** ISO timestamp → value for <input type="datetime-local"> ("YYYY-MM-DDTHH:mm"). */
export function toLocalInput(v) {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

/** datetime-local value → "YYYY-MM-DDTHH:mm:00" or null. */
export function fromLocalInput(v) {
  return v ? `${v.slice(0, 16)}:00` : null;
}

/** "YYYY-MM" of the previous calendar month. */
export function previousMonth(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Copy text to clipboard with a textarea fallback. Resolves true on success. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Map an ApiError's `fields` (or {}) for Field `error` props. */
export const fieldErrors = (err) => (err && err.fields) || {};
