import { SliderField } from '../../../../components/Field';
import { CHART_COLORS, CHART_GOLD, CHART_NAVY } from '../../../../components/Charts';
import { retirementCalc } from '../../../../utils/calc';
import { CalcShell, GrowthChart, RATE, inr, lc, useCalcState } from './shared';

const FIELDS = {
  age: { def: 30, min: 18, max: 70 },
  retire: { def: 60, min: 40, max: 75 },
  life: { def: 85, min: 60, max: 100 },
  expense: { def: 50000, min: 5000, max: 1000000 },
  inflation: { def: 6, min: 0, max: 15 },
  pre: { def: 12, ...RATE },
  post: { def: 7, ...RATE },
};

const yrs = (v) => `${v} yrs`;
const pct = (v) => `${v}%`;

export default function RetirementCalculator({ sync = false, headingLevel = 2 }) {
  const { values, n, set, query } = useCalcState(FIELDS, sync);
  const invalid = n.retire <= n.age || n.life <= n.retire;
  const r = retirementCalc({
    age: n.age,
    retireAge: n.retire,
    lifeExpectancy: n.life,
    monthlyExpense: n.expense,
    inflationPct: n.inflation,
    preReturnPct: n.pre,
    postReturnPct: n.post,
  });
  return (
    <CalcShell
      id="retirement"
      title="Retirement calculator"
      headingLevel={headingLevel}
      query={query}
      inputs={
        <>
          <SliderField label="Current age" value={values.age} onChange={set('age')} min={18} max={70} suffix="years" format={yrs} />
          <SliderField label="Retirement age" value={values.retire} onChange={set('retire')} min={40} max={75} suffix="years" format={yrs} />
          <SliderField label="Life expectancy" value={values.life} onChange={set('life')} min={60} max={100} suffix="years" format={yrs} />
          <SliderField label="Current monthly expenses" value={values.expense} onChange={set('expense')} min={5000} max={1000000} step={1000} prefix="₹" format={lc} />
          <SliderField label="Expected inflation (p.a.)" value={values.inflation} onChange={set('inflation')} min={0} max={15} step={0.5} suffix="%" format={pct} />
          <SliderField label="Return before retirement (p.a.)" value={values.pre} onChange={set('pre')} {...RATE} suffix="%" format={pct} />
          <SliderField label="Return after retirement (p.a.)" value={values.post} onChange={set('post')} {...RATE} suffix="%" format={pct} />
          {invalid && (
            <p className="field__error" role="alert">
              Retirement age should be above your current age, and life expectancy above your retirement age.
            </p>
          )}
        </>
      }
      note="Corpus assumes monthly expenses rise with inflation through retirement and the corpus earns the post-retirement return."
      stats={[
        { label: 'Monthly expenses at retirement', value: inr(r.expenseAtRetire), sub: `in ${r.yrsToRetire} years` },
        { label: 'Retirement corpus needed', value: inr(r.corpus), sub: lc(r.corpus), accent: true },
        { label: 'Monthly SIP needed', value: inr(r.monthlySip), sub: `for ${r.yrsToRetire} years` },
      ]}
      chart={
        <GrowthChart
          data={r.series}
          label={`Chart of a monthly SIP of ${inr(r.monthlySip)} building towards a retirement corpus of ${lc(r.corpus)} over ${r.yrsToRetire} years`}
          series={[
            { key: 'invested', name: 'Amount invested', color: CHART_NAVY },
            { key: 'value', name: 'Estimated value', color: CHART_GOLD },
            { key: 'target', name: 'Corpus needed', color: CHART_COLORS[5], type: 'line', dashed: true },
          ]}
        />
      }
      summary={`Retiring at ${n.retire} with today's expenses of ${inr(n.expense)} a month, your expenses may be about ${inr(r.expenseAtRetire)} a month at retirement. To fund ${r.yrsInRetirement} years of retirement you may need a corpus of about ${lc(r.corpus)}, which an illustrative monthly SIP of ${inr(r.monthlySip)} for ${r.yrsToRetire} years at ${n.pre}% could build.`}
      pdf={{
        inputs: [
          ['Current age', `${n.age}`],
          ['Retirement age', `${n.retire}`],
          ['Life expectancy', `${n.life}`],
          ['Monthly expenses today', inr(n.expense)],
          ['Inflation', `${n.inflation}% p.a.`],
          ['Return before retirement', `${n.pre}% p.a.`],
          ['Return after retirement', `${n.post}% p.a.`],
        ],
        results: [
          ['Monthly expenses at retirement', inr(r.expenseAtRetire)],
          ['Retirement corpus needed', inr(r.corpus)],
          ['Monthly SIP needed', inr(r.monthlySip)],
        ],
      }}
    />
  );
}
