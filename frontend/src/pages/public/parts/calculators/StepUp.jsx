import { SliderField } from '../../../../components/Field';
import { CHART_COLORS, CHART_GOLD, CHART_NAVY } from '../../../../components/Charts';
import { stepUpCalc } from '../../../../utils/calc';
import { CalcShell, GrowthChart, RATE, YEARS, inr, lc, useCalcState } from './shared';

const FIELDS = { amount: { def: 5000, min: 500, max: 1000000 }, step: { def: 10, min: 1, max: 50 }, rate: { def: 12, ...RATE }, years: { def: 10, ...YEARS } };

export default function StepUpCalculator({ sync = false, headingLevel = 2 }) {
  const { values, n, set, query } = useCalcState(FIELDS, sync);
  const r = stepUpCalc({ monthly: n.amount, stepPct: n.step, ratePct: n.rate, years: n.years });
  const extra = r.value - r.flatValue;
  return (
    <CalcShell
      id="step-up-sip"
      title="Step-up SIP calculator"
      headingLevel={headingLevel}
      query={query}
      inputs={
        <>
          <SliderField label="Starting monthly SIP" value={values.amount} onChange={set('amount')} min={500} max={1000000} step={500} prefix="₹" format={lc} />
          <SliderField label="Annual step-up" value={values.step} onChange={set('step')} min={1} max={50} suffix="%" format={(v) => `${v}%`} />
          <SliderField label="Expected return (p.a.)" value={values.rate} onChange={set('rate')} {...RATE} suffix="%" format={(v) => `${v}%`} />
          <SliderField label="Investment period" value={values.years} onChange={set('years')} {...YEARS} suffix="years" format={(v) => `${v} yrs`} />
        </>
      }
      note="The SIP amount increases by the step-up percentage every 12 months, compared with a flat SIP of the starting amount."
      stats={[
        { label: 'Total invested (step-up)', value: inr(r.invested), sub: `Final SIP ${inr(r.finalMonthly)}/month` },
        { label: 'Flat SIP value', value: inr(r.flatValue), sub: `${inr(n.amount * n.years * 12)} invested` },
        { label: 'Step-up SIP value', value: inr(r.value), sub: `${lc(extra)} more than flat`, accent: true },
      ]}
      chart={
        <GrowthChart
          data={r.series}
          label={`Chart comparing a step-up SIP, estimated ${lc(r.value)}, with a flat SIP, estimated ${lc(r.flatValue)}, over ${n.years} years`}
          series={[
            { key: 'invested', name: 'Invested (step-up)', color: CHART_NAVY, type: 'line', dashed: true },
            { key: 'flat', name: 'Flat SIP value', color: CHART_COLORS[2], type: 'line' },
            { key: 'value', name: 'Step-up SIP value', color: CHART_GOLD },
          ]}
        />
      }
      summary={`Starting at ${inr(n.amount)} a month and increasing it by ${n.step}% each year for ${n.years} years at an assumed ${n.rate}% return, the illustrative value is ${lc(r.value)}, compared with ${lc(r.flatValue)} for a flat SIP.`}
      pdf={{
        inputs: [['Starting monthly SIP', inr(n.amount)], ['Annual step-up', `${n.step}%`], ['Expected return', `${n.rate}% p.a.`], ['Period', `${n.years} years`]],
        results: [['Total invested (step-up)', inr(r.invested)], ['Flat SIP value', inr(r.flatValue)], ['Step-up SIP value', inr(r.value)], ['Difference', inr(extra)]],
      }}
    />
  );
}
