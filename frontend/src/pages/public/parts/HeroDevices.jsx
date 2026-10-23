import { useEffect, useRef, useState } from 'react';
import { formatINR, formatLakhCrore, formatNumber } from '../../../utils/format';
import { monotonePath, prefersReducedMotion, useTween, useWidth } from '../../../utils/motion';
import { SENSEX_YEAR_END, formatAsOf, useSensexLatest } from './sensexData';

// Hero visual: 3D-tilted mock-ups of the investor dashboard (desktop) and SIP app (phone).
// Everything shown is a sample portfolio for illustration; the caption says so.

const DESIGN = { w: 660, h: 520 }; // the mock-up is laid out at this size and scaled to fit
const MONTHLY = 25000;

// sample 5-year portfolio: ₹3 L start + ₹25k monthly SIP, with deterministic market wobble
const SERIES = (() => {
  const out = [];
  let value = 300000;
  let invested = 300000;
  for (let m = 0; m <= 60; m++) {
    if (m > 0) {
      const r = 0.0112 + 0.034 * Math.sin(m * 0.9) * Math.cos(m * 0.37);
      value = value * (1 + r) + MONTHLY;
      invested += MONTHLY;
    }
    out.push({ m, value, invested });
  }
  return out;
})();
const NOW = SERIES[SERIES.length - 1];
const GAIN = NOW.value - NOW.invested;

const ALLOCATION = [
  { label: 'Equity', pct: 68, color: '#d4af6c' },
  { label: 'Debt', pct: 22, color: '#5f8fbf' },
  { label: 'Hybrid', pct: 10, color: '#3fb27f' },
];
const HOLDINGS = [
  { name: 'Large Cap Fund', type: 'Equity', value: NOW.value * 0.34, ret: 16.8 },
  { name: 'Flexi Cap Fund', type: 'Equity', value: NOW.value * 0.34, ret: 18.2 },
  { name: 'Short Duration Fund', type: 'Debt', value: NOW.value * 0.22, ret: 7.4 },
];
const SIPS = [
  { name: 'Flexi Cap Fund', amt: 10000, ret: 18.2, spark: [3, 5, 4, 7, 6, 9, 11] },
  { name: 'Large Cap Fund', amt: 8000, ret: 16.8, spark: [4, 4, 6, 5, 7, 8, 9] },
  { name: 'Short Duration Fund', amt: 7000, ret: 7.4, spark: [3, 4, 4, 5, 5, 6, 6] },
];
const TOASTS = ['SIP of ₹10,000 processed', 'Monthly statement is ready', 'Goal is 62% funded'];

function PortfolioChart() {
  const W = 470;
  const H = 128;
  const max = NOW.value * 1.05;
  const x = (i) => (i / (SERIES.length - 1)) * W;
  const y = (v) => H - (v / max) * (H - 6);
  const valuePts = SERIES.map((d, i) => [x(i), y(d.value)]);
  const line = monotonePath(valuePts);
  const invested = monotonePath(SERIES.map((d, i) => [x(i), y(d.invested)]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pub-hd-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pub-hd-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4af6c" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#d4af6c" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="pub-hd-grid" />
      ))}
      <path d={`${line}L${W},${H}L0,${H}Z`} fill="url(#hd-fill)" className="pub-hd-area" />
      <path d={invested} className="pub-hd-invested" />
      <path d={line} className="pub-hd-line" pathLength="1" />
      <circle cx={valuePts[valuePts.length - 1][0]} cy={valuePts[valuePts.length - 1][1]} r="4" className="pub-hd-end" />
    </svg>
  );
}

function Donut() {
  const r = 34;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 90 90" className="pub-hd-donut">
      <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="11" />
      {ALLOCATION.map((a, i) => {
        const len = (a.pct / 100) * c;
        const el = (
          <circle
            key={a.label}
            cx="45"
            cy="45"
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth="11"
            strokeDasharray={`${len - 2} ${c}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 45 45)"
            className="pub-hd-donut__seg"
            style={{ animationDelay: `${0.9 + i * 0.25}s` }}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

function Spark({ pts }) {
  const max = Math.max(...pts);
  const d = monotonePath(pts.map((v, i) => [(i / (pts.length - 1)) * 44, 16 - (v / max) * 14]));
  return (
    <svg viewBox="0 0 44 18" className="pub-hd-spark">
      <path d={d} />
    </svg>
  );
}

function useToast() {
  const [state, setState] = useState({ i: 0, show: false });
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const t = setTimeout(
      () => setState((s) => (s.show ? { i: (s.i + 1) % TOASTS.length, show: false } : { ...s, show: true })),
      state.show ? 3200 : 2600
    );
    return () => clearTimeout(t);
  }, [state]);
  return state;
}

export default function HeroDevices() {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const value = useTween(NOW.value, { duration: 1800 });
  const gain = useTween(GAIN, { duration: 1800 });
  const goal = useTween(62, { duration: 2000 });
  const toast = useToast();
  const scale = width ? width / DESIGN.w : 0;
  const latest = useSensexLatest();
  const lastYe = SENSEX_YEAR_END[SENSEX_YEAR_END.length - 1];
  const prevYe = SENSEX_YEAR_END[SENSEX_YEAR_END.length - 2];
  // latest daily close when available, else the latest year-end close and that year's change
  const idx = latest
    ? { close: latest.close, chg: latest.changePct, when: formatAsOf(latest.asOf).replace(/ d{4}$/, '') }
    : { close: lastYe.close, chg: (lastYe.close / prevYe.close - 1) * 100, when: String(lastYe.year) };

  const onMove = (e) => {
    if (e.pointerType !== 'mouse' || prefersReducedMotion()) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -8, y: ((e.clientX - r.left) / r.width - 0.5) * 10 });
  };
  const ringC = 2 * Math.PI * 26;

  return (
    <figure className="pub-hd">
      <div
        ref={wrapRef}
        className="pub-hd__stage"
        style={{ height: scale ? DESIGN.h * scale : undefined }}
        onPointerMove={onMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        role="img"
        aria-label="Sample Aureus investor dashboard and SIP app"
      >
        {scale > 0 && (
          <div className="pub-hd__scale" style={{ width: DESIGN.w, height: DESIGN.h, transform: `scale(${scale})` }} aria-hidden="true">
            <div className="pub-hd__scene" style={{ '--tx': `${tilt.x}deg`, '--ty': `${tilt.y}deg` }}>
              {/* desktop dashboard */}
              <div className="pub-hd-desk">
                <div className="pub-hd-desk__bar">
                  <span className="pub-hd-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="pub-hd-desk__title">
                    <b>AF</b> Investor dashboard
                  </span>
                  <span className="pub-hd-desk__idx">
                    SENSEX {formatNumber(Math.round(idx.close))}{' '}
                    <em className={idx.chg < 0 ? 'is-down' : undefined}>
                      {idx.chg < 0 ? '▼' : '▲'} {formatNumber(Math.abs(idx.chg), 2)}%
                    </em>
                    <small> {idx.when}</small>
                  </span>
                </div>
                <div className="pub-hd-desk__body">
                  <div className="pub-hd-desk__top">
                    <div>
                      <span className="pub-hd-label">Current value</span>
                      <strong className="pub-hd-big">{formatINR(Math.round(value), { decimals: 0 })}</strong>
                      <span className="pub-hd-gain">
                        ▲ {formatINR(Math.round(gain), { decimals: 0 })} ({formatNumber((GAIN / NOW.invested) * 100, 1)}%)
                      </span>
                      <div className="pub-hd-tabs">
                        {['1M', '1Y', '3Y', '5Y'].map((t) => (
                          <span key={t} className={t === '5Y' ? 'is-on' : undefined}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="pub-hd-alloc">
                      <Donut />
                      <ul>
                        {ALLOCATION.map((a) => (
                          <li key={a.label}>
                            <i style={{ background: a.color }} />
                            {a.label} <b>{a.pct}%</b>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <PortfolioChart />
                  <div className="pub-hd-rows">
                    {HOLDINGS.map((h) => (
                      <div key={h.name} className="pub-hd-row">
                        <span>
                          <b>{h.name}</b>
                          <small>{h.type}</small>
                        </span>
                        <span className="pub-hd-row__v">{formatLakhCrore(h.value, { decimals: 2 })}</span>
                        <span className="pub-hd-row__r">+{formatNumber(h.ret, 1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* phone */}
              <div className="pub-hd-phone">
                <div className="pub-hd-phone__screen">
                  <div className="pub-hd-phone__status">
                    <span>9:41</span>
                    <span className="pub-hd-phone__notch" />
                    <span>●●●</span>
                  </div>
                  <div className={`pub-hd-toast${toast.show ? ' is-on' : ''}`}>
                    <span className="pub-hd-toast__icon">✓</span>
                    {TOASTS[toast.i]}
                  </div>
                  <div className="pub-hd-phone__head">
                    <strong>My SIPs</strong>
                    <span className="pub-hd-avatar">AF</span>
                  </div>
                  <div className="pub-hd-card">
                    <span className="pub-hd-label">Monthly SIP</span>
                    <strong className="pub-hd-mid">{formatINR(MONTHLY, { decimals: 0 })}</strong>
                    <span className="pub-hd-muted">3 active · next on 5th</span>
                  </div>
                  <div className="pub-hd-card pub-hd-goal">
                    <svg viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" className="pub-hd-goal__track" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        className="pub-hd-goal__bar"
                        strokeDasharray={`${(goal / 100) * ringC} ${ringC}`}
                        transform="rotate(-90 32 32)"
                      />
                      <text x="32" y="36" textAnchor="middle">
                        {Math.round(goal)}%
                      </text>
                    </svg>
                    <span>
                      <b>Child’s education</b>
                      <span className="pub-hd-muted">₹14.9 L of ₹24 L</span>
                    </span>
                  </div>
                  {SIPS.map((s) => (
                    <div key={s.name} className="pub-hd-sip">
                      <span>
                        <b>{s.name}</b>
                        <span className="pub-hd-muted">{formatINR(s.amt, { decimals: 0 })}/month</span>
                      </span>
                      <Spark pts={s.spark} />
                      <span className="pub-hd-row__r">+{formatNumber(s.ret, 1)}%</span>
                    </div>
                  ))}
                  <span className="pub-hd-btn">Start a new SIP</span>
                </div>
              </div>

              {/* floating chips */}
              <div className="pub-hd-chip pub-hd-chip--a">
                <span className="pub-hd-chip__dot" />
                <span>
                  <small>Portfolio returns</small>
                  <b>+{formatNumber((GAIN / NOW.invested) * 100, 1)}%</b>
                </span>
              </div>
              <div className="pub-hd-chip pub-hd-chip--b">
                <span className="pub-hd-chip__icon">₹</span>
                <span>
                  <small>Invested so far</small>
                  <b>{formatLakhCrore(NOW.invested, { decimals: 1 })}</b>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
