import { useId, useMemo, useRef, useState } from 'react';
import Button from '../../../components/Button';
import { SectionHeading } from '../../../components/Misc';
import { formatLakhCrore, formatNumber } from '../../../utils/format';
import { labelIndices, monotonePath, nearestIndex, niceTicks, useInView, useTween, useWidth } from '../../../utils/motion';
import { formatAsOf, sensexSeries, useSensexLatest } from './sensexData';

const RANGES = [
  { key: '5Y', label: '5Y', years: 5 },
  { key: '10Y', label: '10Y', years: 10 },
  { key: '20Y', label: '20Y', years: 20 },
  { key: 'ALL', label: 'All', years: Infinity },
];

const PAD = { top: 24, right: 16, bottom: 30, left: 4 };
const axisLabel = (v) => (v >= 1000 ? `${formatNumber(v / 1000)}K` : formatNumber(v));

/** Range summary: total change, CAGR, what ₹1 lakh became and the steepest calendar-year fall (complete years only). */
function summarise(data) {
  const first = data[0].close;
  const last = data[data.length - 1].close;
  const years = data[data.length - 1].t - data[0].t;
  let worst = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i].partial) continue;
    const chg = (data[i].close / data[i - 1].close - 1) * 100;
    if (chg < 0 && (!worst || chg < worst.chg)) worst = { year: data[i].year, chg, index: i };
  }
  return {
    years,
    changePct: (last / first - 1) * 100,
    cagr: (Math.pow(last / first, 1 / years) - 1) * 100,
    lakhBecomes: (1e5 * last) / first,
    worst,
  };
}

function SensexChart({ data, rangeKey, inView, worst, hover, setHover }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const gid = useId().replace(/:/g, '');
  const w = width || 640;
  const h = w < 560 ? 230 : 300;
  const values = data.map((d) => d.close);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const { lo, hi, ticks } = niceTicks(rangeKey === 'ALL' ? 0 : min - (max - min) * 0.2, max, 4);
  const x = (i) => PAD.left + (i / (data.length - 1)) * (w - PAD.left - PAD.right);
  const y = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * (h - PAD.top - PAD.bottom);
  const pts = data.map((d, i) => [x(i), y(d.close)]);
  const line = monotonePath(pts);
  const base = h - PAD.bottom;
  const area = `${line}L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z`;
  const last = pts[pts.length - 1];
  const hp = hover !== null ? pts[hover] : null;
  const showWorst = worst && w >= 480;

  return (
    <div ref={wrapRef} className={`pub-pulse__chart${inView ? ' is-in' : ''}`}>
      {width > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={`BSE Sensex year-end close from ${data[0].year} (${formatNumber(data[0].close)}) to ${data[data.length - 1].year} (${formatNumber(data[data.length - 1].close)})`}
          onPointerMove={(e) => setHover(nearestIndex(e, data.length, w, PAD.left, PAD.right))}
          onPointerDown={(e) => setHover(nearestIndex(e, data.length, w, PAD.left, PAD.right))}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4af6c" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#d4af6c" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${gid}-line`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8a6a2f" />
              <stop offset="100%" stopColor="#c99a45" />
            </linearGradient>
          </defs>
          <g className="pub-pulse__gridlines">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} />
                {t !== lo && (
                  <text x={PAD.left + 2} y={y(t) - 6}>
                    {axisLabel(t)}
                  </text>
                )}
              </g>
            ))}
          </g>
          <g className="pub-pulse__xaxis">
            {labelIndices(data.length, w < 560 ? 4 : 7).map((i) => (
              <text key={i} x={x(i)} y={h - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
                {data[i].year}
              </text>
            ))}
          </g>
          {/* key replays the draw-in animation whenever the range changes */}
          <g key={rangeKey}>
            <path className="pub-pulse__area" d={area} fill={`url(#${gid}-fill)`} />
            <path className="pub-pulse__line" d={line} pathLength="1" stroke={`url(#${gid}-line)`} />
            {showWorst && (
              <g className="pub-pulse__note">
                <circle cx={pts[worst.index][0]} cy={pts[worst.index][1]} r="4" />
                <text x={pts[worst.index][0]} y={Math.min(base - 8, pts[worst.index][1] + 22)} textAnchor="middle">
                  {worst.year} · {formatNumber(worst.chg, 0)}%
                </text>
              </g>
            )}
            <g className="pub-pulse__end">
              <circle className="pub-pulse__ping" cx={last[0]} cy={last[1]} r="6" />
              <circle cx={last[0]} cy={last[1]} r="5" />
            </g>
          </g>
          {hp && (
            <g className="pub-pulse__cursor" aria-hidden="true">
              <line x1={hp[0]} x2={hp[0]} y1={PAD.top - 8} y2={base} />
              <circle cx={hp[0]} cy={hp[1]} r="6" />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

/** Home page band: animated BSE Sensex chart (year-end closes + latest daily close) with range switcher and long-term stats. */
export default function SensexPulse() {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, 0.15);
  const [rangeKey, setRangeKey] = useState('ALL');
  const [hover, setHover] = useState(null);
  const latest = useSensexLatest();
  const series = useMemo(() => sensexSeries(latest), [latest]);
  const range = RANGES.find((r) => r.key === rangeKey);
  const data = useMemo(() => (range.years === Infinity ? series : series.slice(-(range.years + 1))), [range, series]);
  const s = useMemo(() => summarise(data), [data]);
  const lastClose = data[data.length - 1].close;
  const shown = hover !== null ? data[hover] : data[data.length - 1];
  const shownChange = (shown.close / data[0].close - 1) * 100;
  const tweenClose = useTween(lastClose, { duration: 1400, active: inView });
  const tweenChange = useTween(s.changePct, { duration: 1400, active: inView });
  const valueText = hover !== null ? formatNumber(shown.close) : formatNumber(Math.round(tweenClose));
  const changeText = hover !== null ? shownChange : tweenChange;
  const up = changeText >= 0;
  const daily = hover === null && latest && data[data.length - 1].partial ? latest : null;
  const years = Math.round(s.years);

  return (
    <section ref={sectionRef} className={`section pub-pulse${inView ? ' is-in' : ''}`} aria-labelledby="pulse-title">
      <div className="container pub-pulse__grid">
        <div className="pub-pulse__copy">
          <SectionHeading
            eyebrow="Markets over time"
            title={<span id="pulse-title">Patience has been rewarded</span>}
            lead="The Sensex has been through crashes, crises and a pandemic, and has still grown many times over. Staying invested has mattered more than picking the right moment."
          />
          <dl className="pub-pulse__stats">
            <div>
              <dt>Yearly growth</dt>
              <dd className="num">{formatNumber(s.cagr, 1)}%</dd>
              <span className="tiny muted">CAGR, {years} years</span>
            </div>
            <div>
              <dt>₹1 lakh became</dt>
              <dd className="num">{formatLakhCrore(s.lakhBecomes, { decimals: 1 })}</dd>
              <span className="tiny muted">
                {data[0].year} to {data[data.length - 1].year}
              </span>
            </div>
            <div>
              <dt>Worst year</dt>
              <dd className="num">{s.worst ? `${formatNumber(s.worst.chg, 1)}%` : 'None'}</dd>
              <span className="tiny muted">{s.worst ? `in ${s.worst.year}` : 'no down year'}</span>
            </div>
          </dl>
          <div className="row pub-pulse__ctas">
            <Button to="/calculators/sip">Plan a SIP</Button>
            <Button variant="outline" to="/contact">
              Talk to us
            </Button>
          </div>
        </div>

        <div className="pub-pulse__card">
          <div className="pub-pulse__head">
            <div>
              <span className="pub-pulse__index">
                <span className="pub-pulse__badge" aria-hidden="true">
                  S
                </span>
                BSE SENSEX
              </span>
              <div className="pub-pulse__value num" aria-live="off">
                {valueText}
              </div>
              {daily && (
                <div className="pub-pulse__change">
                  <span className={`pub-pulse__pill ${daily.changePct >= 0 ? 'is-up' : 'is-down'}`}>
                    <span aria-hidden="true">{daily.changePct >= 0 ? '▲' : '▼'}</span> {formatNumber(Math.abs(daily.changePct), 2)}%
                  </span>
                  <span className="small muted">Close on {formatAsOf(daily.asOf)}</span>
                </div>
              )}
              <div className="pub-pulse__change">
                <span className={`pub-pulse__pill ${daily ? 'is-quiet' : ''} ${up ? 'is-up' : 'is-down'}`}>
                  <span aria-hidden="true">{up ? '▲' : '▼'}</span> {formatNumber(Math.abs(changeText), Math.abs(changeText) > 999 ? 0 : 1)}%
                </span>
                <span className="small muted">
                  {hover !== null ? `${data[0].year} year-end to ${shown.label}` : `over ${years} years${daily ? '' : ` · ${shown.label} close`}`}
                </span>
              </div>
            </div>
            <div className="pub-pulse__ranges" role="group" aria-label="Chart period">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={r.key === rangeKey ? 'is-active' : undefined}
                  aria-pressed={r.key === rangeKey}
                  onClick={() => {
                    setRangeKey(r.key);
                    setHover(null);
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <SensexChart data={data} rangeKey={rangeKey} inView={inView} worst={s.worst} hover={hover} setHover={setHover} />
          <p className="tiny muted pub-pulse__note-text">
            BSE Sensex calendar year-end closing values{latest ? ', plus the latest close (updated after market hours each trading day, not live)' : ''}. Price
            index, dividends not included. Past performance may or may not be sustained in future and is not a guarantee of future returns. Shown for
            education only; not a recommendation.
          </p>
        </div>
      </div>
    </section>
  );
}
