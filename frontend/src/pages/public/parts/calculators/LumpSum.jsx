import { SliderField } from '../../../../components/Field';
import { CHART_GOLD, CHART_NAVY } from '../../../../components/Charts';
import { lumpsumCalc } from '../../../../utils/calc';
import { CalcShell, GrowthChart, RATE, YEARS, inr, lc, useCalcState } from './shared';

const FIELDS = { amount: { def: 100000, min: 1000, max: 100000000 }, rate: { def: 12, ...RATE }, years: { def: 10, ...YEARS } };

export default function LumpSumCalculator({ sync = false, headingLevel = 2 }) {
  const { values, n, set, query } = useCalcState(FIELDS, sync);
  const r = lumpsumCalc({ amount: n.amount, ratePct: n.rate, years: n.years });
  return (
    <CalcShell
      id="lump-sum"
      title="Lump sum calculator"
      headingLevel={headingLevel}
      query={query}
      inputs={
        <>
          <SliderField label="One-time investment" value={values.amount} onChange={set('amount')} min={1000} max={100000000} step={1000} prefix="₹" format={lc} />
          <SliderField label="Expected return (p.a.)" value={values.rate} onChange={set('rate')} {...RATE} suffix="%" format={(v) => `${v}%`} />
          <SliderField label="Investment period" value={values.years} onChange={set('years')} {...YEARS} suffix="years" format={(v) => `${v} yrs`} />
        </>
      }
      note="Future value = P × (1 + r)^t, compounded annually."
      stats={[
        { label: 'Amount invested', value: inr(r.invested), sub: lc(r.invested) },
        { label: 'Estimated gains', value: inr(r.gain), sub: lc(r.gain) },
        { label: 'Estimated value', value: inr(r.value), sub: lc(r.value), accent: true },
      ]}
      chart={
        <GrowthChart
          data={r.series}
          label={`Chart of lump sum growth over ${n.years} years from ${lc(n.amount)} to an estimated ${lc(r.value)}`}
          series={[
            { key: 'invested', name: 'Amount invested', color: CHART_NAVY, type: 'line' },
            { key: 'value', name: 'Estimated value', color: CHART_GOLD },
          ]}
        />
      }
      summary={`A one-time investment of ${inr(n.amount)} for ${n.years} years at an assumed ${n.rate}% a year would have an illustrative value of ${lc(r.value)}.`}
      pdf={{
        inputs: [['Investment', inr(n.amount)], ['Expected return', `${n.rate}% p.a.`], ['Period', `${n.years} years`]],
        results: [['Amount invested', inr(r.invested)], ['Estimated gains', inr(r.gain)], ['Estimated value', inr(r.value)]],
      }}
    />
  );
}
