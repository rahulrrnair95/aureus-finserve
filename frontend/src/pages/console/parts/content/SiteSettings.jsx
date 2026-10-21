import { adminApi, publicApi } from '../../../../api/endpoints';
import { Field, Input, Textarea } from '../../../../components/Field';
import { EMAIL_RE } from '../common';
import { DocEditor, isUrlOrEmpty } from './shared';

const STATS = [
  ['aumCr', 'AUM (₹ crore)', 'decimal'],
  ['clients', 'Clients', 'numeric'],
  ['families', 'Families', 'numeric'],
  ['years', 'Years in business', 'numeric'],
  ['sipBookCr', 'Monthly SIP book (₹ crore)', 'decimal'],
  ['sipsRunning', 'SIPs running', 'numeric'],
];
const SOCIALS = [
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['linkedin', 'LinkedIn'],
  ['youtube', 'YouTube'],
  ['x', 'X (Twitter)'],
];
const str = (v) => (v == null ? '' : String(v));

export default function SiteSettings() {
  return (
    <DocEditor
      title="Site settings"
      intro="Trust numbers, contact details and social links used across the public site. Blank social links are hidden."
      load={() => publicApi.site()}
      save={(b) => adminApi.updateSite(b)}
      toForm={(d) => ({
        stats: Object.fromEntries(STATS.map(([k]) => [k, str(d.stats?.[k])])),
        socials: Object.fromEntries(SOCIALS.map(([k]) => [k, str(d.socials?.[k])])),
        phone: str(d.phone),
        whatsapp: str(d.whatsapp),
        email: str(d.email),
        address: str(d.address),
        officeHours: str(d.officeHours),
        mapEmbedUrl: str(d.mapEmbedUrl),
      })}
      toBody={(f) => ({
        stats: Object.fromEntries(STATS.map(([k]) => [k, f.stats[k] === '' ? null : Number(f.stats[k])])),
        socials: Object.fromEntries(SOCIALS.map(([k]) => [k, f.socials[k].trim() || null])),
        phone: f.phone.trim(),
        whatsapp: f.whatsapp.trim(),
        email: f.email.trim(),
        address: f.address.trim(),
        officeHours: f.officeHours.trim(),
        mapEmbedUrl: f.mapEmbedUrl.trim() || null,
      })}
      validate={(f) => {
        const e = {};
        STATS.forEach(([k]) => {
          if (f.stats[k] !== '' && !(Number(f.stats[k]) >= 0)) e[`stats.${k}`] = 'Enter a number.';
        });
        SOCIALS.forEach(([k]) => {
          if (!isUrlOrEmpty(f.socials[k].trim())) e[`socials.${k}`] = 'Enter a full https:// URL.';
        });
        if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.';
        if (!isUrlOrEmpty(f.mapEmbedUrl.trim())) e.mapEmbedUrl = 'Enter a full https:// URL.';
        return e;
      }}
      render={({ form, set, setForm, errors }) => {
        const setIn = (group, k) => (e) => setForm((f) => ({ ...f, [group]: { ...f[group], [k]: e.target.value } }));
        return (
          <>
            <fieldset className="con-fieldset">
              <legend className="field__label">Trust numbers</legend>
              <div className="form-grid form-grid--3">
                {STATS.map(([k, label, mode]) => (
                  <Field key={k} label={label} error={errors[`stats.${k}`]}>
                    <Input type="number" min="0" step={mode === 'decimal' ? '0.01' : '1'} inputMode={mode} value={form.stats[k]} onChange={setIn('stats', k)} />
                  </Field>
                ))}
              </div>
            </fieldset>
            <fieldset className="con-fieldset">
              <legend className="field__label">Contact</legend>
              <div className="form-grid form-grid--2">
                <Field label="Phone" error={errors.phone}>
                  <Input type="tel" value={form.phone} onChange={set('phone')} />
                </Field>
                <Field label="WhatsApp" error={errors.whatsapp} hint="Number with country code, e.g. 919876543210">
                  <Input type="tel" value={form.whatsapp} onChange={set('whatsapp')} />
                </Field>
                <Field label="Email" error={errors.email}>
                  <Input type="email" value={form.email} onChange={set('email')} />
                </Field>
                <Field label="Office hours" error={errors.officeHours}>
                  <Input value={form.officeHours} onChange={set('officeHours')} />
                </Field>
                <Field label="Address" error={errors.address} className="span-2">
                  <Textarea rows={2} value={form.address} onChange={set('address')} />
                </Field>
                <Field label="Map embed URL" error={errors.mapEmbedUrl} className="span-2">
                  <Input type="url" value={form.mapEmbedUrl} onChange={set('mapEmbedUrl')} />
                </Field>
              </div>
            </fieldset>
            <fieldset className="con-fieldset">
              <legend className="field__label">Social links</legend>
              <div className="form-grid form-grid--2">
                {SOCIALS.map(([k, label]) => (
                  <Field key={k} label={label} error={errors[`socials.${k}`]} hint="Leave blank to hide">
                    <Input type="url" value={form.socials[k]} onChange={setIn('socials', k)} />
                  </Field>
                ))}
              </div>
            </fieldset>
          </>
        );
      }}
    />
  );
}
