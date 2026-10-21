import { adminApi } from '../../../../api/endpoints';
import { formatDateTime } from '../../../../utils/format';
import { Checkbox, Field, Input, Textarea } from '../../../../components/Field';
import { fromLocalInput, toLocalInput } from '../common';
import { CrudSection, isUrlOrEmpty } from './shared';

export default function Banners() {
  return (
    <CrudSection
      title="Banners"
      noun="banner"
      intro="Announcement banners on the public site. A banner shows when active and within its optional start/end window."
      load={() => adminApi.cmsBanners()}
      create={(b) => adminApi.createBanner(b)}
      update={(row, b) => adminApi.updateBanner(row.id, b)}
      remove={(row) => adminApi.deleteBanner(row.id)}
      blank={{ title: '', text: '', ctaLabel: '', ctaUrl: '', active: true, startsAt: '', endsAt: '' }}
      toForm={(r) => ({
        title: r.title || '',
        text: r.text || '',
        ctaLabel: r.ctaLabel || '',
        ctaUrl: r.ctaUrl || '',
        active: !!r.active,
        startsAt: toLocalInput(r.startsAt),
        endsAt: toLocalInput(r.endsAt),
      })}
      toBody={(f) => ({
        title: f.title.trim(),
        text: f.text.trim(),
        ctaLabel: f.ctaLabel.trim() || null,
        ctaUrl: f.ctaUrl.trim() || null,
        active: !!f.active,
        startsAt: fromLocalInput(f.startsAt),
        endsAt: fromLocalInput(f.endsAt),
      })}
      validate={(f) => {
        const e = {};
        if (!f.title.trim()) e.title = 'Enter a title.';
        if (!isUrlOrEmpty(f.ctaUrl.trim())) e.ctaUrl = 'Enter a full https:// URL or a site path like /contact.';
        if (f.ctaLabel.trim() && !f.ctaUrl.trim()) e.ctaUrl = 'Add a link for the button.';
        if (f.startsAt && f.endsAt && f.endsAt <= f.startsAt) e.endsAt = 'End must be after the start.';
        return e;
      }}
      renderForm={({ form, set, errors }) => (
        <>
          <Field label="Title" required error={errors.title}>
            <Input value={form.title} onChange={set('title')} data-autofocus />
          </Field>
          <Field label="Text" error={errors.text}>
            <Textarea rows={3} value={form.text} onChange={set('text')} />
          </Field>
          <div className="form-grid form-grid--2">
            <Field label="Button label" error={errors.ctaLabel}>
              <Input value={form.ctaLabel} onChange={set('ctaLabel')} />
            </Field>
            <Field label="Button link" error={errors.ctaUrl} hint="/contact or https://…">
              <Input value={form.ctaUrl} onChange={set('ctaUrl')} />
            </Field>
            <Field label="Starts at (optional)" error={errors.startsAt}>
              <Input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} />
            </Field>
            <Field label="Ends at (optional)" error={errors.endsAt}>
              <Input type="datetime-local" value={form.endsAt} onChange={set('endsAt')} />
            </Field>
          </div>
          <Checkbox label="Active" checked={form.active} onChange={set('active')} />
        </>
      )}
      columns={[
        { key: 'title', header: 'Title', primary: true },
        { key: 'active', header: 'Active', render: (r) => (r.active ? <span className="chip chip--success">Active</span> : <span className="chip">Inactive</span>) },
        { key: 'startsAt', header: 'Starts', render: (r) => (r.startsAt ? formatDateTime(r.startsAt) : '—') },
        { key: 'endsAt', header: 'Ends', render: (r) => (r.endsAt ? formatDateTime(r.endsAt) : '—') },
      ]}
    />
  );
}
