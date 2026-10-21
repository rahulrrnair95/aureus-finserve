import { SliderField } from '../../../../components/Field';
import { CHART_GOLD, CHART_NAVY } from '../../../../components/Charts';
import { sipCalc } from '../../../../utils/calc';
import { CalcShell, GrowthChart, RATE, YEARS, inr, lc, useCalcState } from './shared';

const FIELDS = { amount: { def: 5000, min: 500, max: 1000000 }, rate: { def: 12, ...RATE }, years: { def: 10, ...YEARS } };

export default function SipCalculator({ sync = false, headingLevel = 2 }) {
  const { values, n, set, query } = useCalcState(FIELDS, sync);
  const r = sipCalc({ monthly: n.amount, ratePct: n.rate, years: n.years });
  return (
    <CalcShell
      id="sip"
      title="SIP calculator"
      headingLevel={headingLevel}
      query={query}
      inputs={
        <>
          <SliderField label="Monthly investment" value={values.amount} onChange={set('amount')} min={500} max={1000000} step={500} prefix="₹" format={lc} />
          <SliderField label="Expected return (p.a.)" value={values.rate} onChange={set('rate')} {...RATE} suffix="%" format={(v) => `${v}%`} />
          <SliderField label="Investment period" value={values.years} onChange={set('years')} {...YEARS} suffix="years" format={(v) => `${v} yrs`} />
        </>
      }
      note="Assumes the instalment is invested at the start of every month, compounded monthly."
      stats={[
        { label: 'Total invested', value: inr(r.invested), sub: lc(r.invested) },
        { label: 'Estimated gains', value: inr(r.gain), sub: lc(r.gain) },
        { label: 'Estimated value', value: inr(r.value), sub: lc(r.value), accent: true },
      ]}
      chart={
        <GrowthChart
          data={r.series}
          label={`Chart of SIP growth over ${n.years} years: invested ${lc(r.invested)}, estimated value ${lc(r.value)}`}
          series={[
            { key: 'invested', name: 'Amount invested', color: CHART_NAVY },
            { key: 'value', name: 'Estimated value', color: CHART_GOLD },
          ]}
        />
      }
      summary={`Investing ${inr(n.amount)} every month for ${n.years} years at an assumed ${n.rate}% a year: you would invest ${lc(r.invested)}, and the illustrative value would be ${lc(r.value)}.`}
      pdf={{
        inputs: [['Monthly investment', inr(n.amount)], ['Expected return', `${n.rate}% p.a.`], ['Period', `${n.years} years`]],
        results: [['Total invested', inr(r.invested)], ['Estimated gains', inr(r.gain)], ['Estimated value', inr(r.value)]],
      }}
    />
  );
}
