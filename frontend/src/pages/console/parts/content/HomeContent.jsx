import { adminApi } from '../../../../api/endpoints';
import { Checkbox, Field, Input, Textarea } from '../../../../components/Field';
import { DocEditor, RepeatList } from './shared';

const SECTIONS = [
  ['trust', 'Trust numbers'],
  ['services', 'Services cards'],
  ['why', 'Why choose us'],
  ['how', 'How it works'],
  ['calculator', 'SIP calculator widget'],
  ['amcs', 'AMC partners strip'],
  ['testimonials', 'Testimonials'],
  ['articles', 'Latest articles'],
];

const pad = (arr, n, make) => {
  const a = [...(arr || [])].slice(0, n);
  while (a.length < n) a.push(make(a.length));
  return a;
};

function toForm(d) {
  return {
    hero: { headline: '', subline: '', primaryCtaLabel: '', secondaryCtaLabel: '', ...(d.hero || {}) },
    whyChooseUs: pad(d.whyChooseUs, 4, () => ({ title: '', text: '' })).map((x) => ({ title: x.title || '', text: x.text || '' })),
    howItWorks: pad(d.howItWorks, 3, (i) => ({ step: i + 1, title: '', text: '' })).map((x, i) => ({ step: x.step ?? i + 1, title: x.title || '', text: x.text || '' })),
    sections: Object.fromEntries(SECTIONS.map(([k]) => [k, d.sections ? d.sections[k] !== false : true])),
  };
}

export default function HomeContent() {
  return (
    <DocEditor
      title="Home page"
      intro="Hero text, the four “why choose us” points, the three “how it works” steps and which bands are visible."
      load={() => adminApi.cmsHome()}
      save={(b) => adminApi.updateHome(b)}
      toForm={toForm}
      toBody={(f) => ({
        hero: Object.fromEntries(Object.entries(f.hero).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])),
        whyChooseUs: f.whyChooseUs.map((x) => ({ title: x.title.trim(), text: x.text.trim() })),
        howItWorks: f.howItWorks.map((x, i) => ({ step: i + 1, title: x.title.trim(), text: x.text.trim() })),
        sections: f.sections,
      })}
      validate={(f) => {
        const e = {};
        if (!f.hero.headline.trim()) e.headline = 'Enter the headline.';
        if (f.whyChooseUs.some((x) => !x.title.trim())) e.why = 'Every point needs a title.';
        if (f.howItWorks.some((x) => !x.title.trim())) e.how = 'Every step needs a title.';
        return e;
      }}
      render={({ form, setForm, errors }) => {
        const setHero = (k) => (e) => setForm((f) => ({ ...f, hero: { ...f.hero, [k]: e.target.value } }));
        return (
          <>
            <fieldset className="con-fieldset">
              <legend className="field__label">Hero</legend>
              <div className="form-grid form-grid--2">
                <Field label="Headline" required error={errors.headline} className="span-2">
                  <Input value={form.hero.headline} onChange={setHero('headline')} />
                </Field>
                <Field label="Sub-line" className="span-2">
                  <Textarea rows={2} value={form.hero.subline} onChange={setHero('subline')} />
                </Field>
                <Field label="Primary button label">
                  <Input value={form.hero.primaryCtaLabel} onChange={setHero('primaryCtaLabel')} />
                </Field>
                <Field label="Secondary button label">
                  <Input value={form.hero.secondaryCtaLabel} onChange={setHero('secondaryCtaLabel')} />
                </Field>
              </div>
            </fieldset>

            <RepeatList
              legend="Why choose us (4 points)"
              fixed
              items={form.whyChooseUs}
              onChange={(whyChooseUs) => setForm((f) => ({ ...f, whyChooseUs }))}
              render={(x, update, i) => (
                <div className="form-grid form-grid--2">
                  <Field label={`Point ${i + 1} title`} required error={!x.title.trim() ? errors.why : undefined}>
                    <Input value={x.title} onChange={(e) => update({ title: e.target.value })} />
                  </Field>
                  <Field label={`Point ${i + 1} text`}>
                    <Textarea rows={2} value={x.text} onChange={(e) => update({ text: e.target.value })} />
                  </Field>
                </div>
              )}
            />

            <RepeatList
              legend="How it works (3 steps)"
              fixed
              items={form.howItWorks}
              onChange={(howItWorks) => setForm((f) => ({ ...f, howItWorks }))}
              render={(x, update, i) => (
                <div className="form-grid form-grid--2">
                  <Field label={`Step ${i + 1} title`} required error={!x.title.trim() ? errors.how : undefined}>
                    <Input value={x.title} onChange={(e) => update({ title: e.target.value })} />
                  </Field>
                  <Field label={`Step ${i + 1} text`}>
                    <Textarea rows={2} value={x.text} onChange={(e) => update({ text: e.target.value })} />
                  </Field>
                </div>
              )}
            />

            <fieldset className="con-fieldset">
              <legend className="field__label">Visible bands</legend>
              <p className="tiny muted">The header, hero and footer are always shown.</p>
              <div className="con-checks">
                {SECTIONS.map(([k, label]) => (
                  <Checkbox key={k} label={label} checked={!!form.sections[k]} onChange={(e) => setForm((f) => ({ ...f, sections: { ...f.sections, [k]: e.target.checked } }))} />
                ))}
              </div>
            </fieldset>
          </>
        );
      }}
    />
  );
}
