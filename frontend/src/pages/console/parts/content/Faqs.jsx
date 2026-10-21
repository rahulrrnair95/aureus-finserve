import { adminApi } from '../../../../api/endpoints';
import { Field, Input, Textarea } from '../../../../components/Field';
import { CrudSection } from './shared';

export default function Faqs() {
  return (
    <CrudSection
      title="FAQs"
      noun="FAQ"
      intro="Shown on the FAQs page, grouped by category and ordered by sort order."
      load={() => adminApi.cmsFaqs()}
      create={(b) => adminApi.createFaq(b)}
      update={(row, b) => adminApi.updateFaq(row.id, b)}
      remove={(row) => adminApi.deleteFaq(row.id)}
      blank={{ question: '', answer: '', category: '', sortOrder: '0' }}
      toForm={(r) => ({ question: r.question || '', answer: r.answer || '', category: r.category || '', sortOrder: String(r.sortOrder ?? 0) })}
      toBody={(f) => ({ question: f.question.trim(), answer: f.answer.trim(), category: f.category.trim(), sortOrder: Number(f.sortOrder) || 0 })}
      validate={(f) => {
        const e = {};
        if (!f.question.trim()) e.question = 'Enter the question.';
        if (!f.answer.trim()) e.answer = 'Enter the answer.';
        if (!f.category.trim()) e.category = 'Enter a category.';
        return e;
      }}
      sortRows={(rows) => [...rows].sort((a, b) => String(a.category).localeCompare(String(b.category)) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))}
      renderForm={({ form, set, errors }) => (
        <>
          <Field label="Question" required error={errors.question}>
            <Input value={form.question} onChange={set('question')} data-autofocus />
          </Field>
          <Field label="Answer" required error={errors.answer}>
            <Textarea rows={5} value={form.answer} onChange={set('answer')} />
          </Field>
          <div className="form-grid form-grid--2">
            <Field label="Category" required error={errors.category}>
              <Input value={form.category} onChange={set('category')} />
            </Field>
            <Field label="Sort order" error={errors.sortOrder} hint="Lower numbers appear first">
              <Input type="number" value={form.sortOrder} onChange={set('sortOrder')} />
            </Field>
          </div>
        </>
      )}
      columns={[
        { key: 'question', header: 'Question', primary: true },
        { key: 'category', header: 'Category' },
        { key: 'sortOrder', header: 'Order', num: true },
      ]}
    />
  );
}
