import { adminApi } from '../../../../api/endpoints';
import { formatDateTime } from '../../../../utils/format';
import StatusChip from '../../../../components/StatusChip';
import { Field, Input, Textarea } from '../../../../components/Field';
import { fromLocalInput, slugify, toLocalInput } from '../common';
import { CrudSection, isUrlOrEmpty } from './shared';

const BLANK = { title: '', slug: '', summary: '', category: '', body: '', publishAt: '', readMinutes: '5', videoUrl: '', _slugTouched: false };

function statusFor(publishAt) {
  if (!publishAt) return 'DRAFT';
  const t = new Date(publishAt).getTime();
  return t > Date.now() ? 'SCHEDULED' : 'PUBLISHED';
}

const HINT = {
  DRAFT: 'No publish date — saved as a draft and hidden from the website.',
  SCHEDULED: 'Future date — scheduled; it goes live automatically at that time.',
  PUBLISHED: 'Past or current date — published and visible on the website.',
};

function ArticleForm({ form, set, setForm, errors }) {
  const st = statusFor(form.publishAt);
  return (
    <div className="form-grid form-grid--2">
      <Field label="Title" required error={errors.title} className="span-2">
        <Input
          value={form.title}
          data-autofocus
          onChange={(e) => {
            const title = e.target.value;
            setForm((f) => ({ ...f, title, slug: f._slugTouched ? f.slug : slugify(title) }));
          }}
        />
      </Field>
      <Field label="Slug" required error={errors.slug} hint={`URL: /learn/articles/${form.slug || '…'}`}>
        <Input
          value={form.slug}
          spellCheck={false}
          onChange={(e) => {
            const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            setForm((f) => ({ ...f, slug, _slugTouched: slug !== '' }));
          }}
        />
      </Field>
      <Field label="Category" required error={errors.category} hint="e.g. Basics, Tax, SIP">
        <Input value={form.category} onChange={set('category')} />
      </Field>
      <Field label="Summary" required error={errors.summary} className="span-2">
        <Textarea rows={2} value={form.summary} onChange={set('summary')} />
      </Field>
      <Field label="Body" required error={errors.body} className="span-2" hint='Leave a blank line between paragraphs. Start a line with "## " for a subheading.'>
        <Textarea rows={14} value={form.body} onChange={set('body')} className="con-mono" />
      </Field>
      <Field label="Publish at" error={errors.publishAt} hint={HINT[st]}>
        <Input type="datetime-local" value={form.publishAt} onChange={set('publishAt')} />
      </Field>
      <div className="field">
        <span className="field__label">Status when saved</span>
        <span aria-live="polite">
          <StatusChip status={st} />
        </span>
        {form.publishAt && (
          <button type="button" className="btn btn--link btn--sm" onClick={() => setForm((f) => ({ ...f, publishAt: '' }))}>
            Clear date (save as draft)
          </button>
        )}
      </div>
      <Field label="Read time (minutes)" error={errors.readMinutes}>
        <Input type="number" min="1" max="120" value={form.readMinutes} onChange={set('readMinutes')} />
      </Field>
      <Field label="Video URL (optional)" error={errors.videoUrl} hint="YouTube or other https link">
        <Input type="url" value={form.videoUrl} onChange={set('videoUrl')} />
      </Field>
    </div>
  );
}

export default function Articles() {
  return (
    <CrudSection
      title="Articles"
      noun="article"
      intro="Knowledge centre articles. Drafts are hidden; scheduled articles go live at their publish time."
      wide
      load={() => adminApi.cmsArticles()}
      create={(b) => adminApi.createArticle(b)}
      update={(row, b) => adminApi.updateArticle(row.id, b)}
      remove={(row) => adminApi.deleteArticle(row.id)}
      blank={BLANK}
      toForm={(r) => ({
        title: r.title || '',
        slug: r.slug || '',
        summary: r.summary || '',
        category: r.category || '',
        body: r.body || '',
        publishAt: toLocalInput(r.publishAt),
        readMinutes: r.readMinutes != null ? String(r.readMinutes) : '',
        videoUrl: r.videoUrl || '',
        _slugTouched: true,
      })}
      toBody={(f) => ({
        title: f.title.trim(),
        slug: f.slug.replace(/^-+|-+$/g, ''),
        summary: f.summary.trim(),
        category: f.category.trim(),
        body: f.body,
        publishAt: fromLocalInput(f.publishAt),
        readMinutes: f.readMinutes ? Number(f.readMinutes) : null,
        videoUrl: f.videoUrl.trim() || null,
      })}
      validate={(f) => {
        const e = {};
        if (!f.title.trim()) e.title = 'Enter a title.';
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug.replace(/^-+|-+$/g, ''))) e.slug = 'Use lowercase letters, numbers and hyphens.';
        if (!f.summary.trim()) e.summary = 'Enter a summary.';
        if (!f.category.trim()) e.category = 'Enter a category.';
        if (!f.body.trim()) e.body = 'Enter the article body.';
        if (f.readMinutes && !(Number(f.readMinutes) >= 1)) e.readMinutes = 'Enter minutes (1 or more).';
        if (!isUrlOrEmpty(f.videoUrl.trim())) e.videoUrl = 'Enter a valid https:// URL.';
        return e;
      }}
      renderForm={(p) => <ArticleForm {...p} />}
      columns={[
        { key: 'title', header: 'Title', primary: true },
        { key: 'category', header: 'Category' },
        { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status || statusFor(r.publishAt)} /> },
        { key: 'publishAt', header: 'Publish at', render: (r) => (r.publishAt ? formatDateTime(r.publishAt) : '—') },
        { key: 'updatedAt', header: 'Updated', render: (r) => (r.updatedAt ? formatDateTime(r.updatedAt) : '—') },
      ]}
    />
  );
}
