// Indian number / currency / date formatting helpers (Intl 'en-IN').

const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const num = (min, max) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: min, maximumFractionDigits: max });

const isNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));

/** ₹1,23,456.78 */
export function formatINR(v, { decimals = 2 } = {}) {
  if (!isNum(v)) return '—';
  return (decimals === 0 ? inr0 : inr2).format(Number(v));
}

/** 1,23,456 (no symbol) */
export function formatNumber(v, decimals = 0) {
  if (!isNum(v)) return '—';
  return num(decimals, decimals).format(Number(v));
}

export function formatUnits(v) {
  if (!isNum(v)) return '—';
  return num(3, 4).format(Number(v));
}

export function formatNav(v) {
  if (!isNum(v)) return '—';
  return num(4, 4).format(Number(v));
}

/** 14.2 → "14.20%" ; signed=true → "+14.20%" */
export function formatPct(v, { decimals = 2, signed = false } = {}) {
  if (!isNum(v)) return '—';
  const n = Number(v);
  const s = num(decimals, decimals).format(n);
  return `${signed && n > 0 ? '+' : ''}${s}%`;
}

/** Lakh / crore compact: ₹12.5 L, ₹3.2 Cr */
export function formatLakhCrore(v, { symbol = true, decimals = 2 } = {}) {
  if (!isNum(v)) return '—';
  const n = Number(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const p = symbol ? '₹' : '';
  if (abs >= 1e7) return `${sign}${p}${num(0, decimals).format(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}${p}${num(0, decimals).format(abs / 1e5)} L`;
  return `${sign}${p}${num(0, 0).format(abs)}`;
}

export const toLakh = (v) => Number(v) / 1e5;
export const toCrore = (v) => Number(v) / 1e7;

/** Value already in crores (e.g., aumCr) → "₹32,150.50 Cr" */
export function formatCr(v, decimals = 2) {
  if (!isNum(v)) return '—';
  return `₹${num(0, decimals).format(Number(v))} Cr`;
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' });

function parseDate(v) {
  if (!v) return null;
  // Treat plain YYYY-MM-DD as local date
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v)) {
    const [y, m] = v.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(v) {
  const d = parseDate(v);
  return d ? dateFmt.format(d) : '—';
}

export function formatDateTime(v) {
  const d = parseDate(v);
  return d ? dateTimeFmt.format(d) : '—';
}

export function formatMonth(v) {
  const d = parseDate(v);
  return d ? monthFmt.format(d) : '';
}

export function toISODate(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/** "VERY_HIGH" → "Very High" */
export function humanize(v) {
  if (!v) return '';
  return String(v)
    .toLowerCase()
    .split('_')
    .map((w) => (w === 'to' ? 'to' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export const RISK_LEVELS = ['LOW', 'LOW_TO_MODERATE', 'MODERATE', 'MODERATELY_HIGH', 'HIGH', 'VERY_HIGH'];
