import { useState } from 'react';
import { SliderField } from '../../../components/Field';
import Button from '../../../components/Button';
import { sipCalc } from '../../../utils/calc';
import { CALC_DISCLAIMER } from '../../../utils/pdf';
import { formatINR, formatLakhCrore } from '../../../utils/format';

const clamp = (v, min, max, def) => (v === '' || Number.isNaN(Number(v)) ? def : Math.min(max, Math.max(min, Number(v))));

/** Compact inline SIP calculator for the home page. */
export default function MiniSip() {
  const [monthly, setMonthly] = useState(5000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);
  const m = clamp(monthly, 500, 1000000, 5000);
  const r = clamp(rate, 1, 30, 12);
  const y = clamp(years, 1, 40, 10);
  const res = sipCalc({ monthly: m, ratePct: r, years: y });
  const investedPct = res.value > 0 ? Math.min(100, (res.invested / res.value) * 100) : 100;
  const qs = new URLSearchParams({ amount: m, rate: r, years: y }).toString();

  return (
    <div className="pub-mini card">
      <form className="pub-mini__inputs stack-lg" onSubmit={(e) => e.preventDefault()} aria-label="SIP calculator inputs">
        <SliderField label="Monthly SIP" value={monthly} onChange={setMonthly} min={500} max={1000000} step={500} prefix="₹" format={(v) => formatLakhCrore(v)} />
        <SliderField label="Expected return (p.a.)" value={rate} onChange={setRate} min={1} max={30} step={0.5} suffix="%" format={(v) => `${v}%`} />
        <SliderField label="Investment period" value={years} onChange={setYears} min={1} max={40} suffix="years" format={(v) => `${v} yrs`} />
      </form>
      <div className="pub-mini__result">
        <div className="stat">
          <span className="stat__label">Amount invested</span>
          <span className="stat__value">{formatINR(res.invested, { decimals: 0 })}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Estimated value</span>
          <span className="stat__value pub-mini__value">{formatINR(res.value, { decimals: 0 })}</span>
          <span className="stat__sub">
            {formatLakhCrore(res.value)} after {y} years
          </span>
        </div>
        <div className="pub-mini__bar" aria-hidden="true">
          <span style={{ width: `${investedPct}%` }} />
        </div>
        <div className="row tiny muted">
          <span className="pub-dot pub-dot--navy" aria-hidden="true" /> Invested
          <span className="pub-dot pub-dot--gold" aria-hidden="true" /> Estimated gains
        </div>
        <div className="row">
          <Button variant="outline" to={`/calculators/sip?${qs}`}>
            Open full calculator
          </Button>
          <Button variant="link" to="/calculators">
            More calculators
          </Button>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          {CALC_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
