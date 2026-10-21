import { adminApi } from '../../../../api/endpoints';
import { Checkbox, Field, Input, Textarea } from '../../../../components/Field';
import { Alert } from '../../../../components/States';
import { CrudSection, isUrlOrEmpty } from './shared';

// Flags text that looks like a return figure ("12%", "returns of", "doubled").
const RETURN_RE = /(\d+(\.\d+)?\s*%|\breturns?\b|\bdoubled\b|\bguarantee)/i;

export default function Testimonials() {
  return (
    <CrudSection
      title="Testimonials"
      noun="testimonial"
      intro="Only testimonials with recorded consent can be shown."
      load={() => adminApi.cmsTestimonials()}
      create={(b) => adminApi.createTestimonial(b)}
      update={(row, b) => adminApi.updateTestimonial(row.id, b)}
      remove={(row) => adminApi.deleteTestimonial(row.id)}
      blank={{ name: '', city: '', text: '', photoUrl: '', consent: false, active: false }}
      toForm={(r) => ({ name: r.name || '', city: r.city || '', text: r.text || '', photoUrl: r.photoUrl || '', consent: !!r.consent, active: !!r.active })}
      toBody={(f) => ({ name: f.name.trim(), city: f.city.trim(), text: f.text.trim(), photoUrl: f.photoUrl.trim() || null, consent: !!f.consent, active: !!f.active && !!f.consent })}
      validate={(f) => {
        const e = {};
        if (!f.name.trim()) e.name = 'Enter the name.';
        if (!f.text.trim()) e.text = 'Enter the testimonial.';
        if (!isUrlOrEmpty(f.photoUrl.trim())) e.photoUrl = 'Enter a full https:// URL.';
        if (f.active && !f.consent) e.consent = 'Consent is required before a testimonial can be shown.';
        return e;
      }}
      renderForm={({ form, set, setForm, errors }) => (
        <>
          <Alert type="warning" title="Compliance">
            Never include return figures, performance claims or promises in testimonials.
          </Alert>
          <div className="form-grid form-grid--2">
            <Field label="Name" required error={errors.name}>
              <Input value={form.name} onChange={set('name')} data-autofocus />
            </Field>
            <Field label="City" error={errors.city}>
              <Input value={form.city} onChange={set('city')} />
            </Field>
          </div>
          <Field label="Testimonial" required error={errors.text || (RETURN_RE.test(form.text) ? 'This text appears to mention returns or percentages. Please remove them.' : undefined)}>
            <Textarea rows={4} value={form.text} onChange={set('text')} />
          </Field>
          <Field label="Photo URL (optional)" error={errors.photoUrl}>
            <Input type="url" value={form.photoUrl} onChange={set('photoUrl')} />
          </Field>
          <Field error={errors.consent}>
            <Checkbox
              label="The client has given written consent to publish this testimonial"
              checked={form.consent}
              onChange={(e) => {
                const consent = e.target.checked;
                setForm((f) => ({ ...f, consent, active: consent ? f.active : false }));
              }}
            />
          </Field>
          <Checkbox label="Active (shown on the website)" checked={form.active} disabled={!form.consent} onChange={set('active')} />
        </>
      )}
      columns={[
        { key: 'name', header: 'Name', primary: true },
        { key: 'city', header: 'City' },
        { key: 'text', header: 'Text', render: (r) => <span className="con-detail">{r.text}</span> },
        { key: 'consent', header: 'Consent', render: (r) => (r.consent ? <span className="chip chip--success">Yes</span> : <span className="chip chip--warning">No</span>) },
        { key: 'active', header: 'Active', render: (r) => (r.active ? <span className="chip chip--success">Active</span> : <span className="chip">Hidden</span>) },
      ]}
    />
  );
}
