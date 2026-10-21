import { adminApi } from '../../../../api/endpoints';
import { Field, Input, Textarea } from '../../../../components/Field';
import { DocEditor, RepeatList, isUrlOrEmpty } from './shared';

const s = (v) => (typeof v === 'string' ? v.trim() : v ?? '');

export default function AboutContent() {
  return (
    <DocEditor
      title="About page"
      intro="Firm story, mission and vision, values, milestones and office details shown on the About page."
      load={() => adminApi.cmsAbout()}
      save={(b) => adminApi.updateAbout(b)}
      toForm={(d) => ({
        story: d.story || '',
        mission: d.mission || '',
        vision: d.vision || '',
        values: (d.values || []).map((x) => ({ title: x.title || '', text: x.text || '' })),
        milestones: (d.milestones || []).map((x) => ({ year: x.year != null ? String(x.year) : '', text: x.text || '' })),
        officeAddress: d.officeAddress || '',
        mapEmbedUrl: d.mapEmbedUrl || '',
        officeHours: d.officeHours || '',
      })}
      toBody={(f) => ({
        story: f.story,
        mission: s(f.mission),
        vision: s(f.vision),
        values: f.values.filter((x) => x.title.trim()).map((x) => ({ title: s(x.title), text: s(x.text) })),
        milestones: f.milestones.filter((x) => x.year.trim() || x.text.trim()).map((x) => ({ year: s(x.year), text: s(x.text) })),
        officeAddress: s(f.officeAddress),
        mapEmbedUrl: s(f.mapEmbedUrl) || null,
        officeHours: s(f.officeHours),
      })}
      validate={(f) => {
        const e = {};
        if (!f.story.trim()) e.story = 'Enter the firm story.';
        if (!isUrlOrEmpty(f.mapEmbedUrl.trim())) e.mapEmbedUrl = 'Enter a full https:// URL.';
        return e;
      }}
      render={({ form, set, setForm, errors }) => (
        <>
          <Field label="Our story" required error={errors.story} hint="Leave a blank line between paragraphs.">
            <Textarea rows={8} value={form.story} onChange={set('story')} />
          </Field>
          <div className="form-grid form-grid--2">
            <Field label="Mission" error={errors.mission}>
              <Textarea rows={3} value={form.mission} onChange={set('mission')} />
            </Field>
            <Field label="Vision" error={errors.vision}>
              <Textarea rows={3} value={form.vision} onChange={set('vision')} />
            </Field>
          </div>

          <RepeatList
            legend="Values"
            itemLabel="value"
            addLabel="Add value"
            items={form.values}
            onChange={(values) => setForm((f) => ({ ...f, values }))}
            newItem={() => ({ title: '', text: '' })}
            render={(x, update, i) => (
              <div className="form-grid form-grid--2">
                <Field label={`Value ${i + 1} title`}>
                  <Input value={x.title} onChange={(e) => update({ title: e.target.value })} />
                </Field>
                <Field label={`Value ${i + 1} text`}>
                  <Textarea rows={2} value={x.text} onChange={(e) => update({ text: e.target.value })} />
                </Field>
              </div>
            )}
          />

          <RepeatList
            legend="Milestones"
            itemLabel="milestone"
            reorder
            addLabel="Add milestone"
            items={form.milestones}
            onChange={(milestones) => setForm((f) => ({ ...f, milestones }))}
            newItem={() => ({ year: '', text: '' })}
            render={(x, update, i) => (
              <div className="form-grid con-grid-year">
                <Field label={`Milestone ${i + 1} year`}>
                  <Input value={x.year} inputMode="numeric" maxLength={9} onChange={(e) => update({ year: e.target.value })} />
                </Field>
                <Field label={`Milestone ${i + 1} text`}>
                  <Input value={x.text} onChange={(e) => update({ text: e.target.value })} />
                </Field>
              </div>
            )}
          />

          <fieldset className="con-fieldset">
            <legend className="field__label">Office</legend>
            <div className="form-grid form-grid--2">
              <Field label="Office address" className="span-2">
                <Textarea rows={2} value={form.officeAddress} onChange={set('officeAddress')} />
              </Field>
              <Field label="Office hours">
                <Input value={form.officeHours} onChange={set('officeHours')} />
              </Field>
              <Field label="Map embed URL" error={errors.mapEmbedUrl} hint="Google Maps “Embed a map” src URL">
                <Input type="url" value={form.mapEmbedUrl} onChange={set('mapEmbedUrl')} />
              </Field>
            </div>
          </fieldset>
        </>
      )}
    />
  );
}
