import { Field, Select, SliderField } from '../../../../components/Field';
import { ELSS_CAP, elssCalc } from '../../../../utils/calc';
import { CalcShell, inr, lc, useCalcState } from './shared';

const FIELDS = { amount: { def: 150000, min: 500, max: 1000000 }, slab: { def: '30', options: ['5', '20', '30'] }, regime: { def: 'OLD', options: ['OLD', 'NEW'] } };

export default function ElssCalculator({ sync = false, headingLevel = 2 }) {
  const { values, n, set, query } = useCalcState(FIELDS, sync);
  const r = elssCalc({ annualInvestment: n.amount, slabPct: Number(n.slab), regime: n.regime });
  const isNew = n.regime === 'NEW';
  const summary = isNew
    ? 'Under the new tax regime, Section 80C deductions are not available, so ELSS investments do not reduce your tax. ELSS can still be considered as an equity investment with a three-year lock-in.'
    : `Investing ${inr(n.amount)} in ELSS in a year, ${inr(r.eligible)} qualifies under Section 80C (maximum ${lc(ELSS_CAP)}). At a ${n.slab}% slab, the estimated tax saved including 4% cess is ${inr(r.taxSaved)}.`;
  return (
    <CalcShell
      id="elss"
      title="ELSS tax saving calculator"
      headingLevel={headingLevel}
      query={query}
      inputs={
        <>
          <SliderField label="Annual ELSS investment" value={values.amount} onChange={set('amount')} min={500} max={1000000} step={500} prefix="₹" format={lc} />
          <Field label="Tax regime">
            <Select
              value={values.regime}
              onChange={(e) => set('regime')(e.target.value)}
              options={[
                { value: 'OLD', label: 'Old regime (deductions allowed)' },
                { value: 'NEW', label: 'New regime (no 80C deduction)' },
              ]}
            />
          </Field>
          <Field label="Income tax slab" hint="Your marginal slab rate before cess">
            <Select value={values.slab} onChange={(e) => set('slab')(e.target.value)} disabled={isNew} options={['5', '20', '30'].map((s) => ({ value: s, label: `${s}%` }))} />
          </Field>
        </>
      }
      note="Deduction under Section 80C is capped at ₹1.5 lakh a year across all eligible instruments, and applies only under the old regime. Surcharge is ignored. Please consult a tax adviser."
      stats={[
        { label: 'Eligible under 80C', value: inr(r.eligible), sub: n.amount > ELSS_CAP && !isNew ? `Capped at ${lc(ELSS_CAP)}` : isNew ? 'Not available' : 'Within the limit' },
        { label: 'Tax saved (before cess)', value: inr(r.baseSaved), sub: isNew ? 'New regime' : `${n.slab}% slab` },
        { label: 'Estimated tax saved', value: inr(r.taxSaved), sub: 'Including 4% cess', accent: true },
      ]}
      summary={summary}
      extra={
        isNew ? (
          <p className="alert alert--info small" style={{ marginTop: '1rem' }}>
            The new tax regime does not allow the Section 80C deduction, so the tax saving is ₹0.
          </p>
        ) : null
      }
      pdf={{
        inputs: [['Annual ELSS investment', inr(n.amount)], ['Tax regime', isNew ? 'New' : 'Old'], ['Slab', isNew ? 'n/a' : `${n.slab}%`]],
        results: [['Eligible under 80C', inr(r.eligible)], ['Tax saved before cess', inr(r.baseSaved)], ['Estimated tax saved', inr(r.taxSaved)]],
        notes: ['ELSS investments have a three-year lock-in from the date of each investment.'],
      }}
    />
  );
}
