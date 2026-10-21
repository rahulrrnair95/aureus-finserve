import { SliderField } from '../../../../components/Field';
import { CHART_GOLD, CHART_NAVY } from '../../../../components/Charts';
import { costOfDelayCalc } from '../../../../utils/calc';
import { CalcShell, GrowthChart, RATE, YEARS, inr, lc, useCalcState } from './shared';

const FIELDS = { amount: { def: 5000, min: 500, max: 1000000 }, rate: { def: 12, ...RATE }, years: { def: 20, ...YEARS }, delay: { def: 12, min: 1, max: 120 } };

export default function CostOfDelayCalculator({ sync = false, headingLevel = 2 }) {
  const { values, n, set, query } = useCalcState(FIELDS, sync);
  const delay = Math.min(n.delay, n.years * 12 - 1);
  const r = costOfDelayCalc({ monthly: n.amount, ratePct: n.rate, years: n.years, delayMonths: delay });
  return (
    <CalcShell
      id="cost-of-delay"
      title="Cost of delay calculator"
      headingLevel={headingLevel}
      query={query}
      inputs={
        <>
          <SliderField label="Monthly SIP" value={values.amount} onChange={set('amount')} min={500} max={1000000} step={500} prefix="₹" format={lc} />
          <SliderField label="Expected return (p.a.)" value={values.rate} onChange={set('rate')} {...RATE} suffix="%" format={(v) => `${v}%`} />
          <SliderField label="Investment horizon" value={values.years} onChange={set('years')} {...YEARS} suffix="years" format={(v) => `${v} yrs`} />
          <SliderField label="Delay in starting" value={values.delay} onChange={set('delay')} min={1} max={120} suffix="months" format={(v) => `${v} m`} />
        </>
      }
      note="Both SIPs end at the same horizon; the delayed SIP simply starts later."
      stats={[
        { label: 'If you start now', value: inr(r.now), sub: `${lc(r.investedNow)} invested` },
        { label: `If you start after ${delay} months`, value: inr(r.later), sub: `${lc(r.investedLater)} invested` },
        { label: 'Cost of delay', value: inr(r.cost), sub: r.requiredMonthly ? `SIP of ${inr(r.requiredMonthly)} needed to catch up` : undefined, accent: true },
      ]}
      chart={
        <GrowthChart
          data={r.series}
          label={`Chart comparing starting a SIP now, estimated ${lc(r.now)}, with starting after ${delay} months, estimated ${lc(r.later)}`}
          series={[
            { key: 'delayed', name: `Start after ${delay} months`, color: CHART_NAVY },
            { key: 'now', name: 'Start now', color: CHART_GOLD },
          ]}
        />
      }
      summary={`Delaying a ${inr(n.amount)} monthly SIP by ${delay} months could reduce the illustrative value after ${n.years} years by ${lc(r.cost)}.${r.requiredMonthly ? ` To reach the same amount, the delayed SIP would need to be about ${inr(r.requiredMonthly)} a month.` : ''}`}
      pdf={{
        inputs: [['Monthly SIP', inr(n.amount)], ['Expected return', `${n.rate}% p.a.`], ['Horizon', `${n.years} years`], ['Delay', `${delay} months`]],
        results: [['Value if started now', inr(r.now)], ['Value if delayed', inr(r.later)], ['Cost of delay', inr(r.cost)], ['SIP needed to catch up', r.requiredMonthly ? inr(r.requiredMonthly) : '-']],
      }}
    />
  );
}
