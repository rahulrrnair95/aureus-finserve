import { useId } from 'react';
import { RISK_LEVELS, humanize } from '../utils/format';

const COLORS = ['#2E8B57', '#8BBF3F', '#E2C33B', '#F0A03A', '#E0642D', '#B3261E'];
const SHORT = ['Low', 'Low to Mod.', 'Moderate', 'Mod. High', 'High', 'Very High'];

export function riskLabel(risk) {
  return humanize(risk).replace('Low To Moderate', 'Low to Moderate');
}

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

function arcPath(cx, cy, r0, r1, a0, a1) {
  const [x0, y0] = polar(cx, cy, r1, a0);
  const [x1, y1] = polar(cx, cy, r1, a1);
  const [x2, y2] = polar(cx, cy, r0, a1);
  const [x3, y3] = polar(cx, cy, r0, a0);
  return `M${x0},${y0} A${r1},${r1} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z`;
}

/**
 * SEBI risk-o-meter: semicircle gauge with 6 bands (LOW → VERY_HIGH), needle and text label.
 * <RiskOMeter risk="VERY_HIGH" sidUrl="..." schemeName="..." size={220} />
 */
export default function RiskOMeter({ risk, sidUrl, schemeName, size = 220, showCaption = true }) {
  const titleId = useId();
  const idx = Math.max(0, RISK_LEVELS.indexOf(risk));
  const cx = 100;
  const cy = 104;
  const needleAngle = 180 - (idx * 30 + 15);
  const [nx, ny] = polar(cx, cy, 70, needleAngle);
  const label = riskLabel(RISK_LEVELS[idx]);
  return (
    <figure className="riskometer" style={{ width: size, margin: 0 }}>
      <svg viewBox="0 0 200 122" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`Riskometer${schemeName ? ` for ${schemeName}` : ''}: risk level ${label}`}</title>
        {RISK_LEVELS.map((r, i) => (
          <path key={r} d={arcPath(cx, cy, 52, 92, 180 - i * 30, 180 - (i + 1) * 30)} fill={COLORS[i]} stroke="#fff" strokeWidth="1.5" opacity={i === idx ? 1 : 0.82} />
        ))}
        {RISK_LEVELS.map((r, i) => {
          const [tx, ty] = polar(cx, cy, 72, 180 - (i * 30 + 15));
          return (
            <text key={`t${r}`} x={tx} y={ty} fontSize="6.4" fontWeight="600" fill={i >= 1 && i <= 3 ? '#1B2433' : '#fff'} textAnchor="middle" dominantBaseline="middle" fontFamily="Montserrat, sans-serif" aria-hidden="true">
              {SHORT[i]}
            </text>
          );
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#0B2137" strokeWidth="4" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="8" fill="#0B2137" />
        <circle cx={cx} cy={cy} r="3" fill="#D4AF6C" />
      </svg>
      <figcaption>
        <div className="riskometer__label">Risk: {label}</div>
        {showCaption && (
          <div className="riskometer__caption">
            Investors understand that their principal will be at {label.toLowerCase()} risk.
            {sidUrl && (
              <>
                {' '}
                <a href={sidUrl} target="_blank" rel="noopener noreferrer">
                  Scheme documents (SID, KIM, factsheet)<span className="sr-only"> (opens in new tab)</span>
                </a>
              </>
            )}
          </div>
        )}
      </figcaption>
    </figure>
  );
}

export function RiskBadge({ risk }) {
  const idx = Math.max(0, RISK_LEVELS.indexOf(risk));
  if (!risk) return <span className="muted">—</span>;
  return (
    <span className="risk-badge">
      <span className="risk-badge__dot" style={{ background: COLORS[idx] }} aria-hidden="true" />
      {riskLabel(risk)}
    </span>
  );
}
