import { formatINR, formatLakhCrore, formatPct } from '../utils/format';

/** <Money value={123456.7} /> → ₹1,23,456.70 ; compact → ₹1.23 L ; colored → green/red by sign */
export default function Money({ value, compact = false, decimals = 2, colored = false, signed = false }) {
  const n = Number(value);
  const text = compact ? formatLakhCrore(value) : formatINR(value, { decimals });
  const cls = ['num', colored && !Number.isNaN(n) && (n > 0 ? 'pos' : n < 0 ? 'neg' : '')].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {signed && n > 0 ? '+' : ''}
      {text}
    </span>
  );
}

export function Pct({ value, colored = true, signed = true, decimals = 2 }) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return <span className="muted">—</span>;
  return <span className={`num ${colored ? (n > 0 ? 'pos' : n < 0 ? 'neg' : '') : ''}`}>{formatPct(n, { decimals, signed })}</span>;
}
