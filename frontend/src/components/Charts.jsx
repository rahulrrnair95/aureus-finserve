import { formatINR, formatLakhCrore } from '../utils/format';

// Brand chart palette (navy / gold family + supporting hues, distinguishable and AA against white for marks)
export const CHART_COLORS = ['#0B2137', '#B8913F', '#3D6E9E', '#7A5A9E', '#2E8B57', '#C2593A', '#5B6577', '#9C7C38'];
export const CHART_NAVY = '#0B2137';
export const CHART_GOLD = '#B8913F';
export const CHART_GRID = '#E6E0D4';
export const AXIS_TICK = { fill: '#5B6577', fontSize: 12, fontFamily: 'Montserrat, sans-serif' };

export const compactAxis = (v) => formatLakhCrore(v, { decimals: 1 });

/** Recharts custom tooltip: <Tooltip content={<ChartTooltip labelFormatter={..} />} /> */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = (v) => formatINR(v, { decimals: 0 }) }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="tooltip-box">
      {label !== undefined && <div style={{ fontWeight: 600, marginBottom: 4 }}>{labelFormatter ? labelFormatter(label) : label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 10, height: 10, background: p.color || p.payload?.fill, borderRadius: 2, display: 'inline-block' }} />
          <span>{p.name}:</span>
          <strong>{valueFormatter(p.value, p)}</strong>
        </div>
      ))}
    </div>
  );
}

/** Text legend (accessible, not dependent on chart hover). */
export function Legend({ items }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className="legend__swatch" style={{ background: it.color }} aria-hidden="true" />
          <span>{it.label}</span>
          {it.value !== undefined && <strong className="num">{it.value}</strong>}
        </li>
      ))}
    </ul>
  );
}
