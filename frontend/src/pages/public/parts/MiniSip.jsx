import { useState } from 'react';
import { SliderField } from '../../../components/Field';
import Button from '../../../components/Button';
import { sipCalc } from '../../../utils/calc';
import { CALC_DISCLAIMER } from '../../../utils/pdf';
import SipGrowthChart from './SipGrowthChart';
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
      <form className="pub-mini__inputs" onSubmit={(e) => e.preventDefault()} aria-label="SIP calculator inputs">
        <SliderField label="Monthly SIP" value={monthly} onChange={setMonthly} min={500} max={1000000} step={500} prefix="₹" format={(v) => formatLakhCrore(v)} />
        <SliderField label="Expected return (p.a.)" value={rate} onChange={setRate} min={1} max={30} step={0.5} suffix="%" format={(v) => `${v}%`} />
        <SliderField label="Investment period" value={years} onChange={setYears} min={1} max={40} suffix="years" format={(v) => `${v} yrs`} />
      </form>
      <div className="pub-mini__result">
        <dl className="pub-mini__stats">
          <div>
            <dt>
              <span className="pub-dot pub-dot--navy" aria-hidden="true" /> Invested
            </dt>
            <dd>{formatINR(res.invested, { decimals: 0 })}</dd>
          </div>
          <div>
            <dt>
              <span className="pub-dot pub-dot--gold" aria-hidden="true" /> Estimated gains
            </dt>
            <dd className="pub-mini__gain">+{formatINR(res.gain, { decimals: 0 })}</dd>
          </div>
          <div className="pub-mini__total">
            <dt>Value after {y} years</dt>
            <dd>{formatINR(res.value, { decimals: 0 })}</dd>
          </div>
        </dl>
        <div className="pub-mini__bar" aria-hidden="true">
          <span style={{ width: `${investedPct}%` }} />
        </div>
        <SipGrowthChart series={res.series} />
      </div>
      <div className="pub-mini__actions">
        <Button variant="outline" to={`/calculators/sip?${qs}`}>
          Open full calculator
        </Button>
        <p className="tiny muted">{CALC_DISCLAIMER}</p>
      </div>
    </div>
  );
}
