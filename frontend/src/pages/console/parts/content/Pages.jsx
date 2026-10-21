import { adminApi } from '../../../../api/endpoints';
import { formatDateTime } from '../../../../utils/format';
import { Field, Input, Textarea } from '../../../../components/Field';
import { CrudSection } from './shared';

export default function Pages() {
  return (
    <CrudSection
      title="Pages"
      noun="page"
      intro="Legal and information pages (about, disclaimer, privacy, terms, commission, grievance)."
      wide
      rowKey="key"
      load={() => adminApi.cmsPages()}
      update={(row, b) => adminApi.updatePage(row.key, b)}
      blank={{ title: '', body: '' }}
      toForm={(r) => ({ title: r.title || '', body: r.body || '' })}
      toBody={(f) => ({ title: f.title.trim(), body: f.body })}
      validate={(f) => {
        const e = {};
        if (!f.title.trim()) e.title = 'Enter a title.';
        if (!f.body.trim()) e.body = 'Enter the page content.';
        return e;
      }}
      renderForm={({ form, set, errors, row }) => (
        <>
          <p className="small muted">
            Page key: <code>{row?.key}</code> — shown at <code>/legal/{row?.key}</code>
          </p>
          <Field label="Title" required error={errors.title}>
            <Input value={form.title} onChange={set('title')} data-autofocus />
          </Field>
          <Field label="Body" required error={errors.body} hint='Leave a blank line between paragraphs. Start a line with "## " for a subheading.'>
            <Textarea rows={18} value={form.body} onChange={set('body')} className="con-mono" />
          </Field>
        </>
      )}
      columns={[
        { key: 'title', header: 'Title', primary: true },
        { key: 'key', header: 'Key', render: (r) => <code>{r.key}</code> },
        { key: 'updatedAt', header: 'Updated', render: (r) => formatDateTime(r.updatedAt) },
      ]}
    />
  );
}
