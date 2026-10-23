import { useId, useRef, useState } from 'react';
import { formatINR, formatLakhCrore } from '../../../utils/format';
import { labelIndices, monotonePath, nearestIndex, niceTicks, useInView, useTween, useWidth } from '../../../utils/motion';

const PAD = { top: 16, right: 12, bottom: 28, left: 52 };

/** Animated invested-vs-value area chart for a SIP series ({ year, invested, value } per year). */
export default function SipGrowthChart({ series }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const inView = useInView(ref, 0.3);
  const reveal = useTween(inView ? 1 : 0, { duration: 1600 });
  const [hover, setHover] = useState(null);
  const gid = useId().replace(/:/g, '');

  const data = [{ year: 0, invested: 0, value: 0 }, ...series];
  const w = width || 560;
  const h = w < 440 ? 200 : 300;
  const { hi, ticks } = niceTicks(0, Math.max(...data.map((d) => d.value)), 4);
  const x = (i) => PAD.left + (i / (data.length - 1)) * (w - PAD.left - PAD.right);
  const y = (v) => PAD.top + (1 - v / hi) * (h - PAD.top - PAD.bottom);
  const base = h - PAD.bottom;
  const close = (pts) => `L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z`;
  const valuePts = data.map((d, i) => [x(i), y(d.value)]);
  const investedPts = data.map((d, i) => [x(i), y(d.invested)]);
  const valueLine = monotonePath(valuePts);
  const investedLine = monotonePath(investedPts);
  const hd = hover !== null && hover > 0 ? data[hover] : null;
  const tipLeft = hd ? Math.min(Math.max(x(hover), 90), w - 90) : 0;

  return (
    <div ref={ref} className="pub-sipchart">
      {width > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={`SIP growth over ${series.length} years: ${formatINR(series[series.length - 1]?.invested, { decimals: 0 })} invested, estimated value ${formatINR(series[series.length - 1]?.value, { decimals: 0 })}`}
          onPointerMove={(e) => setHover(nearestIndex(e, data.length, w, PAD.left, PAD.right))}
          onPointerDown={(e) => setHover(nearestIndex(e, data.length, w, PAD.left, PAD.right))}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${gid}-gain`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4af6c" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#d4af6c" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id={`${gid}-inv`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b2137" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1c3f63" stopOpacity="0.75" />
            </linearGradient>
            <clipPath id={`${gid}-clip`}>
              <rect x="0" y="0" width={PAD.left + (w - PAD.left) * reveal} height={h} />
            </clipPath>
          </defs>
          <g className="pub-sipchart__grid">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                  {t === 0 ? '0' : formatLakhCrore(t, { decimals: 1 })}
                </text>
              </g>
            ))}
          </g>
          <g className="pub-sipchart__xaxis">
            {labelIndices(data.length, w < 440 ? 5 : 7).map((i) => (
              <text key={i} x={x(i)} y={h - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
                {i === 0 ? 'Start' : `Yr ${data[i].year}`}
              </text>
            ))}
          </g>
          <g clipPath={`url(#${gid}-clip)`}>
            <path d={valueLine + close(valuePts)} fill={`url(#${gid}-gain)`} />
            <path d={investedLine + close(investedPts)} fill={`url(#${gid}-inv)`} />
            <path className="pub-sipchart__value" d={valueLine} />
          </g>
          {hd && (
            <g className="pub-sipchart__cursor" aria-hidden="true">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={base} />
              <circle cx={x(hover)} cy={y(hd.value)} r="5" className="is-value" />
              <circle cx={x(hover)} cy={y(hd.invested)} r="5" className="is-invested" />
            </g>
          )}
        </svg>
      )}
      {hd && (
        <div className="pub-sipchart__tip" style={{ left: tipLeft }} aria-hidden="true">
          <strong>After {hd.year} {hd.year === 1 ? 'year' : 'years'}</strong>
          <span>
            <i className="pub-dot pub-dot--gold" /> Value {formatINR(hd.value, { decimals: 0 })}
          </span>
          <span>
            <i className="pub-dot pub-dot--navy" /> Invested {formatINR(hd.invested, { decimals: 0 })}
          </span>
        </div>
      )}
    </div>
  );
}
