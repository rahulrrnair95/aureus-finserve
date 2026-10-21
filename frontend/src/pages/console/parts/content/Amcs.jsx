import { useRef, useState } from 'react';
import { adminApi } from '../../../../api/endpoints';
import { friendlyError } from '../../../../api/client';
import Button from '../../../../components/Button';
import { Checkbox, Field, Input } from '../../../../components/Field';
import { Alert } from '../../../../components/States';
import { useToast } from '../../../../components/Toast';
import Icon from '../../../../components/Icon';
import { CrudSection } from './shared';

const MAX = 500 * 1024;
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const logoSrc = (url, bust) => (url ? `${/^https?:/i.test(url) ? url : `${BASE}${url}`}${bust ? `${url.includes('?') ? '&' : '?'}v=${bust}` : ''}` : null);

export function AmcTile({ name, logoUrl, bust }) {
  const [broken, setBroken] = useState(false);
  const src = logoSrc(logoUrl, bust);
  if (src && !broken) {
    return (
      <span className="con-amc-tile">
        <img src={src} alt={`${name} logo`} onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span className="con-amc-tile con-amc-tile--text" aria-label={`${name} (no logo)`}>
      {name}
    </span>
  );
}

function LogoUpload({ row, onUploaded }) {
  const toast = useToast();
  const ref = useRef(null);
  const [file, setFile] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bust, setBust] = useState(0);

  const choose = (e) => {
    const f = e.target.files?.[0] || null;
    setErr(null);
    setFile(null);
    if (!f) return;
    const okType = ['image/png', 'image/svg+xml'].includes(f.type) || /\.(png|svg)$/i.test(f.name);
    if (!okType) return setErr('Logo must be a PNG or SVG file.');
    if (f.size > MAX) return setErr(`Logo must be 500 KB or smaller (this file is ${Math.round(f.size / 1024)} KB).`);
    setFile(f);
  };

  const upload = async () => {
    setBusy(true);
    setErr(null);
    try {
      const amc = await adminApi.uploadAmcLogo(row.id, file);
      onUploaded(amc || row);
      setBust(Date.now());
      setFile(null);
      if (ref.current) ref.current.value = '';
      toast.success('Logo uploaded.');
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="con-fieldset">
      <legend className="field__label">Logo</legend>
      <div className="row">
        <AmcTile name={row.name} logoUrl={row.logoUrl} bust={bust} />
        <span className="tiny muted">{row.logoUrl ? 'Current logo' : 'No logo — a styled text tile is shown on the site.'}</span>
      </div>
      <Field label="Upload new logo" hint="PNG or SVG, up to 500 KB. Uploads immediately; other fields save with “Save”." error={err}>
        <input ref={ref} type="file" accept=".png,.svg,image/png,image/svg+xml" className="input con-file" onChange={choose} />
      </Field>
      <div>
        <Button variant="outline" size="sm" onClick={upload} disabled={!file} loading={busy}>
          <Icon name="upload" size={16} /> Upload logo
        </Button>
      </div>
    </fieldset>
  );
}

export default function Amcs() {
  return (
    <CrudSection
      title="AMC partners"
      noun="AMC"
      intro="AMCs shown on the AMC partners page and home-page strip (active only, by sort order)."
      load={() => adminApi.cmsAmcs()}
      create={(b) => adminApi.createAmc(b)}
      update={(row, b) => adminApi.updateAmc(row.id, b)}
      remove={(row) => adminApi.deleteAmc(row.id)}
      blank={{ name: '', website: '', active: true, sortOrder: '0' }}
      toForm={(r) => ({ name: r.name || '', website: r.website || '', active: !!r.active, sortOrder: String(r.sortOrder ?? 0) })}
      toBody={(f) => ({ name: f.name.trim(), website: f.website.trim() || null, active: !!f.active, sortOrder: Number(f.sortOrder) || 0 })}
      validate={(f) => ({ ...(f.name.trim() ? {} : { name: 'Enter the AMC name.' }), ...(!f.website.trim() || f.website.trim().startsWith('https://') ? {} : { website: 'Use a full https:// address.' }) })}
      sortRows={(rows) => [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))}
      renderForm={({ form, set, errors, row, replaceRow }) => (
        <>
          <Field label="AMC name" required error={errors.name} hint="Must match the AMC name used by schemes (used for the fund explorer filter).">
            <Input value={form.name} onChange={set('name')} data-autofocus />
          </Field>
          <Field label="Official website" error={errors.website} hint="Shown on the AMC partners page, e.g. https://www.sbimf.com">
            <Input type="url" value={form.website} onChange={set('website')} placeholder="https://" />
          </Field>
          <Field label="Sort order" error={errors.sortOrder} hint="Lower numbers appear first">
            <Input type="number" value={form.sortOrder} onChange={set('sortOrder')} />
          </Field>
          <Checkbox label="Active (shown on the website)" checked={form.active} onChange={set('active')} />
          {row ? <LogoUpload row={row} onUploaded={replaceRow} /> : <Alert type="info">Save the AMC first, then edit it to upload a logo.</Alert>}
        </>
      )}
      columns={[
        { key: 'name', header: 'AMC', primary: true },
        { key: 'logo', header: 'Logo', render: (r) => <AmcTile name={r.name} logoUrl={r.logoUrl} /> },
        { key: 'schemeCount', header: 'Schemes', num: true, render: (r) => r.schemeCount ?? '—' },
        { key: 'sortOrder', header: 'Order', num: true },
        { key: 'active', header: 'Active', render: (r) => (r.active ? <span className="chip chip--success">Active</span> : <span className="chip">Hidden</span>) },
      ]}
    />
  );
}
