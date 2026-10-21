import { adminApi } from '../../../../api/endpoints';
import { Checkbox, Field, Input, Textarea } from '../../../../components/Field';
import { CrudSection, isUrlOrEmpty } from './shared';

export default function Team() {
  return (
    <CrudSection
      title="Team"
      noun="team member"
      intro="Founder and team shown on the About page, by sort order."
      wide
      load={() => adminApi.cmsTeam()}
      create={(b) => adminApi.createTeamMember(b)}
      update={(row, b) => adminApi.updateTeamMember(row.id, b)}
      remove={(row) => adminApi.deleteTeamMember(row.id)}
      blank={{ name: '', designation: '', euin: '', bio: '', isFounder: false, qualifications: '', yearsExperience: '', photoUrl: '', sortOrder: '0' }}
      toForm={(r) => ({
        name: r.name || '',
        designation: r.designation || '',
        euin: r.euin || '',
        bio: r.bio || '',
        isFounder: !!r.isFounder,
        qualifications: r.qualifications || '',
        yearsExperience: r.yearsExperience != null ? String(r.yearsExperience) : '',
        photoUrl: r.photoUrl || '',
        sortOrder: String(r.sortOrder ?? 0),
      })}
      toBody={(f) => ({
        name: f.name.trim(),
        designation: f.designation.trim(),
        euin: f.euin.trim() || null,
        bio: f.bio.trim(),
        isFounder: !!f.isFounder,
        qualifications: f.qualifications.trim(),
        yearsExperience: f.yearsExperience === '' ? null : Number(f.yearsExperience),
        photoUrl: f.photoUrl.trim() || null,
        sortOrder: Number(f.sortOrder) || 0,
      })}
      validate={(f) => {
        const e = {};
        if (!f.name.trim()) e.name = 'Enter the name.';
        if (!f.designation.trim()) e.designation = 'Enter the designation.';
        if (f.euin.trim() && !/^E\d{6}$/i.test(f.euin.trim())) e.euin = 'EUIN format is E followed by 6 digits.';
        if (f.yearsExperience !== '' && !(Number(f.yearsExperience) >= 0)) e.yearsExperience = 'Enter a number of years.';
        if (!isUrlOrEmpty(f.photoUrl.trim())) e.photoUrl = 'Enter a full https:// URL.';
        return e;
      }}
      sortRows={(rows) => [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))}
      renderForm={({ form, set, errors }) => (
        <div className="form-grid form-grid--2">
          <Field label="Name" required error={errors.name}>
            <Input value={form.name} onChange={set('name')} data-autofocus />
          </Field>
          <Field label="Designation" required error={errors.designation}>
            <Input value={form.designation} onChange={set('designation')} />
          </Field>
          <Field label="EUIN" error={errors.euin} hint="For staff who advise clients, e.g. E123456">
            <Input value={form.euin} onChange={set('euin')} maxLength={7} />
          </Field>
          <Field label="Qualifications" error={errors.qualifications} hint="e.g. NISM Series V-A certified">
            <Input value={form.qualifications} onChange={set('qualifications')} />
          </Field>
          <Field label="Years of experience" error={errors.yearsExperience} hint="Shown on the website as “10+ years” for 10">
            <Input type="number" min="0" max="70" value={form.yearsExperience} onChange={set('yearsExperience')} />
          </Field>
          <Field label="Sort order" error={errors.sortOrder}>
            <Input type="number" value={form.sortOrder} onChange={set('sortOrder')} />
          </Field>
          <Field label="Photo URL (optional)" error={errors.photoUrl} className="span-2">
            <Input type="url" value={form.photoUrl} onChange={set('photoUrl')} />
          </Field>
          <Field label="Bio" error={errors.bio} className="span-2">
            <Textarea rows={4} value={form.bio} onChange={set('bio')} />
          </Field>
          <div className="span-2">
            <Checkbox label="Founder" checked={form.isFounder} onChange={set('isFounder')} />
          </div>
        </div>
      )}
      columns={[
        { key: 'name', header: 'Name', primary: true },
        { key: 'designation', header: 'Designation' },
        { key: 'euin', header: 'EUIN', render: (r) => r.euin || '—' },
        { key: 'isFounder', header: 'Founder', render: (r) => (r.isFounder ? 'Yes' : '—') },
        { key: 'sortOrder', header: 'Order', num: true },
      ]}
    />
  );
}
