import { SliderField } from '../../../../components/Field';
import { CHART_GOLD, CHART_NAVY } from '../../../../components/Charts';
import { swpCalc, swpSchedule } from '../../../../utils/calc';
import { CalcShell, GrowthChart, RATE, YEARS, inr, lc, useCalcState } from './shared';

const FIELDS = { corpus: { def: 5000000, min: 100000, max: 100000000 }, withdrawal: { def: 30000, min: 500, max: 1000000 }, rate: { def: 8, ...RATE }, years: { def: 20, ...YEARS } };

function monthLabel(m) {
  const y = Math.ceil(m / 12);
  const mm = ((m - 1) % 12) + 1;
  return `Year ${y}, month ${mm}`;
}

export default function SwpCalculator({ sync = false, headingLevel = 2 }) {
  const { values, n, set, query } = useCalcState(FIELDS, sync);
  const r = swpCalc({ corpus: n.corpus, withdrawal: n.withdrawal, ratePct: n.rate, years: n.years });
  const rows = swpSchedule({ corpus: n.corpus, withdrawal: n.withdrawal, ratePct: n.rate, years: n.years });
  const depleted = r.depletedAt ? `The corpus may run out in ${monthLabel(r.depletedAt).toLowerCase()}.` : `A balance of about ${lc(r.finalBalance)} may remain after ${n.years} years.`;
  return (
    <CalcShell
      id="swp"
      title="SWP calculator"
      headingLevel={headingLevel}
      query={query}
      inputs={
        <>
          <SliderField label="Starting corpus" value={values.corpus} onChange={set('corpus')} min={100000} max={100000000} step={10000} prefix="₹" format={lc} />
          <SliderField label="Monthly withdrawal" value={values.withdrawal} onChange={set('withdrawal')} min={500} max={1000000} step={500} prefix="₹" format={lc} />
          <SliderField label="Expected return (p.a.)" value={values.rate} onChange={set('rate')} {...RATE} suffix="%" format={(v) => `${v}%`} />
          <SliderField label="Withdrawal period" value={values.years} onChange={set('years')} {...YEARS} suffix="years" format={(v) => `${v} yrs`} />
        </>
      }
      note="Returns accrue monthly; the withdrawal is taken at the end of each month."
      stats={[
        { label: 'Total withdrawn', value: inr(r.withdrawn), sub: lc(r.withdrawn) },
        { label: 'Final balance', value: inr(r.finalBalance), sub: lc(r.finalBalance), accent: true },
        { label: 'Corpus lasts', value: r.depletedAt ? `${Math.floor(r.depletedAt / 12)} yrs ${r.depletedAt % 12} m` : `${n.years}+ years`, sub: r.depletedAt ? 'Corpus depleted' : 'Within the chosen period' },
      ]}
      chart={
        <GrowthChart
          data={r.series}
          label={`Chart of SWP balance over ${n.years} years starting from ${lc(n.corpus)}; total withdrawn ${lc(r.withdrawn)}`}
          series={[
            { key: 'withdrawn', name: 'Total withdrawn', color: CHART_NAVY, type: 'line' },
            { key: 'balance', name: 'Remaining balance', color: CHART_GOLD },
          ]}
        />
      }
      summary={`Withdrawing ${inr(n.withdrawal)} a month from ${inr(n.corpus)} at an assumed ${n.rate}% return, you would withdraw ${lc(r.withdrawn)} in total. ${depleted}`}
      extra={
        <details className="pub-calc__details">
          <summary>Month-by-month schedule ({rows.length} months)</summary>
          <div className="table-wrap pub-calc__schedule">
            <table className="table">
              <caption className="sr-only">Month-by-month SWP schedule</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className="is-num">Opening</th>
                  <th scope="col" className="is-num">Returns</th>
                  <th scope="col" className="is-num">Withdrawal</th>
                  <th scope="col" className="is-num">Closing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.month}>
                    <th scope="row" className="tiny" style={{ fontWeight: 500 }}>
                      {monthLabel(row.month)}
                    </th>
                    <td className="is-num">{inr(row.opening)}</td>
                    <td className="is-num">{inr(row.growth)}</td>
                    <td className="is-num">{inr(row.withdrawal)}</td>
                    <td className="is-num">{inr(row.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      }
      pdf={{
        inputs: [['Starting corpus', inr(n.corpus)], ['Monthly withdrawal', inr(n.withdrawal)], ['Expected return', `${n.rate}% p.a.`], ['Period', `${n.years} years`]],
        results: [['Total withdrawn', inr(r.withdrawn)], ['Final balance', inr(r.finalBalance)]],
        notes: [depleted],
      }}
    />
  );
}
