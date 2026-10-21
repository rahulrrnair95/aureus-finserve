import { SliderField } from '../../../../components/Field';
import { CHART_COLORS, CHART_GOLD, CHART_NAVY } from '../../../../components/Charts';
import { goalPlan } from '../../../../utils/calc';
import { CalcShell, GrowthChart, RATE, YEARS, inr, lc, useCalcState } from './shared';

const FIELDS = { cost: { def: 2500000, min: 10000, max: 100000000 }, years: { def: 10, ...YEARS }, inflation: { def: 6, min: 0, max: 15 }, rate: { def: 12, ...RATE } };

export default function GoalCalculator({ sync = false, headingLevel = 2 }) {
  const { values, n, set, query } = useCalcState(FIELDS, sync);
  const r = goalPlan({ cost: n.cost, years: n.years, inflationPct: n.inflation, ratePct: n.rate });
  return (
    <CalcShell
      id="goal"
      title="Goal calculator"
      headingLevel={headingLevel}
      query={query}
      inputs={
        <>
          <SliderField label="Cost of the goal today" value={values.cost} onChange={set('cost')} min={10000} max={100000000} step={10000} prefix="₹" format={lc} />
          <SliderField label="Years to goal" value={values.years} onChange={set('years')} {...YEARS} suffix="years" format={(v) => `${v} yrs`} />
          <SliderField label="Expected inflation (p.a.)" value={values.inflation} onChange={set('inflation')} min={0} max={15} step={0.5} suffix="%" format={(v) => `${v}%`} />
          <SliderField label="Expected return (p.a.)" value={values.rate} onChange={set('rate')} {...RATE} suffix="%" format={(v) => `${v}%`} />
        </>
      }
      note="Future cost = C × (1 + inflation)^t. Monthly SIP assumes start-of-month instalments; lump sum assumes annual compounding."
      stats={[
        { label: 'Future cost of goal', value: inr(r.futureCost), sub: lc(r.futureCost) },
        { label: 'Monthly SIP needed', value: inr(r.monthlySip), sub: `for ${n.years} years`, accent: true },
        { label: 'Or lump sum today', value: inr(r.lumpsumNeeded), sub: lc(r.lumpsumNeeded) },
      ]}
      chart={
        <GrowthChart
          data={r.series}
          label={`Chart of a monthly SIP of ${inr(r.monthlySip)} growing towards a goal of ${lc(r.futureCost)} in ${n.years} years`}
          series={[
            { key: 'invested', name: 'Amount invested', color: CHART_NAVY },
            { key: 'value', name: 'Estimated value', color: CHART_GOLD },
            { key: 'target', name: 'Goal (future cost)', color: CHART_COLORS[5], type: 'line', dashed: true },
          ]}
        />
      }
      summary={`A goal costing ${inr(n.cost)} today may cost about ${lc(r.futureCost)} in ${n.years} years at ${n.inflation}% inflation. At an assumed ${n.rate}% return, you could work towards it with a monthly SIP of about ${inr(r.monthlySip)}, or a one-time investment of about ${lc(r.lumpsumNeeded)} today.`}
      pdf={{
        inputs: [['Cost today', inr(n.cost)], ['Years to goal', `${n.years}`], ['Inflation', `${n.inflation}% p.a.`], ['Expected return', `${n.rate}% p.a.`]],
        results: [['Future cost', inr(r.futureCost)], ['Monthly SIP needed', inr(r.monthlySip)], ['Lump sum needed today', inr(r.lumpsumNeeded)]],
      }}
    />
  );
}
