import { adminApi } from '../../../../api/endpoints';
import { Checkbox, Field, Input, Select, Textarea } from '../../../../components/Field';
import { humanize } from '../../../../utils/format';
import { CrudSection, RepeatList } from './shared';

const CALCS = [
  ['sip', 'SIP'],
  ['step-up-sip', 'Step-up SIP'],
  ['lump-sum', 'Lump sum'],
  ['elss', 'ELSS tax saving'],
  ['retirement', 'Retirement'],
  ['goal', 'Goal'],
  ['swp', 'SWP'],
  ['cost-of-delay', 'Cost of delay'],
];

const t = (v) => (typeof v === 'string' ? v.trim() : v);

export default function ServicesContent() {
  return (
    <CrudSection
      title="Services"
      noun="service"
      intro="The eight service pages. Each page uses the same template: what it is, who it suits, how it works, related funds, calculators and FAQs."
      wide
      rowKey="slug"
      load={() => adminApi.cmsServices()}
      update={(row, b) => adminApi.updateService(row.slug, b)}
      blank={{}}
      toForm={(r) => ({
        title: r.title || '',
        shortText: r.shortText || '',
        icon: r.icon || '',
        whatItIs: r.whatItIs || '',
        whoItSuits: r.whoItSuits || '',
        howItWorks: (r.howItWorks || []).map((x) => ({ text: x || '' })),
        relatedCategory: r.relatedCategory || '',
        relatedSubCategories: (r.relatedSubCategories || []).join(', '),
        calculators: r.calculators || [],
        faqs: (r.faqs || []).map((x) => ({ question: x.question || '', answer: x.answer || '' })),
      })}
      toBody={(f, row) => ({
        slug: row.slug,
        title: t(f.title),
        shortText: t(f.shortText),
        ...(f.icon ? { icon: f.icon } : {}),
        whatItIs: t(f.whatItIs),
        whoItSuits: t(f.whoItSuits),
        howItWorks: f.howItWorks.map((x) => t(x.text)).filter(Boolean),
        relatedCategory: f.relatedCategory || null,
        relatedSubCategories: f.relatedSubCategories
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        calculators: CALCS.map(([k]) => k).filter((k) => f.calculators.includes(k)),
        faqs: f.faqs.filter((x) => x.question.trim()).map((x) => ({ question: t(x.question), answer: t(x.answer) })),
      })}
      validate={(f) => {
        const e = {};
        if (!f.title.trim()) e.title = 'Enter a title.';
        if (!f.shortText.trim()) e.shortText = 'Enter a short description.';
        return e;
      }}
      renderForm={({ form, set, setForm, errors, row }) => (
        <>
          <p className="small muted">
            Page: <code>/services/{row?.slug}</code>
          </p>
          <div className="form-grid form-grid--2">
            <Field label="Title" required error={errors.title}>
              <Input value={form.title} onChange={set('title')} data-autofocus />
            </Field>
            <Field label="Short text" required error={errors.shortText} hint="Used on service cards">
              <Input value={form.shortText} onChange={set('shortText')} />
            </Field>
            <Field label="What it is" error={errors.whatItIs} className="span-2">
              <Textarea rows={4} value={form.whatItIs} onChange={set('whatItIs')} />
            </Field>
            <Field label="Who it suits" error={errors.whoItSuits} className="span-2">
              <Textarea rows={3} value={form.whoItSuits} onChange={set('whoItSuits')} />
            </Field>
          </div>

          <RepeatList
            legend="How it works (steps)"
            itemLabel="step"
            addLabel="Add step"
            items={form.howItWorks}
            onChange={(howItWorks) => setForm((f) => ({ ...f, howItWorks }))}
            newItem={() => ({ text: '' })}
            render={(x, update, i) => (
              <Field label={`Step ${i + 1}`}>
                <Input value={x.text} onChange={(e) => update({ text: e.target.value })} />
              </Field>
            )}
          />

          <div className="form-grid form-grid--2">
            <Field label="Related fund category" error={errors.relatedCategory}>
              <Select value={form.relatedCategory} onChange={set('relatedCategory')} placeholder="None" options={['EQUITY', 'DEBT', 'HYBRID'].map((v) => ({ value: v, label: humanize(v) }))} />
            </Field>
            <Field label="Related sub-categories" error={errors.relatedSubCategories} hint="Comma separated, e.g. Large Cap, ELSS">
              <Input value={form.relatedSubCategories} onChange={set('relatedSubCategories')} />
            </Field>
          </div>

          <fieldset className="con-fieldset">
            <legend className="field__label">Calculators shown on this page</legend>
            <div className="con-checks">
              {CALCS.map(([k, label]) => (
                <Checkbox
                  key={k}
                  label={label}
                  checked={form.calculators.includes(k)}
                  onChange={(e) => setForm((f) => ({ ...f, calculators: e.target.checked ? [...f.calculators, k] : f.calculators.filter((x) => x !== k) }))}
                />
              ))}
            </div>
          </fieldset>

          <RepeatList
            legend="FAQs"
            itemLabel="FAQ"
            addLabel="Add FAQ"
            items={form.faqs}
            onChange={(faqs) => setForm((f) => ({ ...f, faqs }))}
            newItem={() => ({ question: '', answer: '' })}
            render={(x, update, i) => (
              <div className="stack">
                <Field label={`FAQ ${i + 1} question`}>
                  <Input value={x.question} onChange={(e) => update({ question: e.target.value })} />
                </Field>
                <Field label={`FAQ ${i + 1} answer`}>
                  <Textarea rows={2} value={x.answer} onChange={(e) => update({ answer: e.target.value })} />
                </Field>
              </div>
            )}
          />
        </>
      )}
      columns={[
        { key: 'title', header: 'Service', primary: true },
        { key: 'slug', header: 'Slug', render: (r) => <code>{r.slug}</code> },
        { key: 'relatedCategory', header: 'Fund category', render: (r) => (r.relatedCategory ? humanize(r.relatedCategory) : '—') },
        { key: 'calculators', header: 'Calculators', render: (r) => (r.calculators?.length ? r.calculators.join(', ') : '—') },
      ]}
    />
  );
}
