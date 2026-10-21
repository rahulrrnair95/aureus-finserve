import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { useAuth } from '../../auth/AuthContext';
import { RISK_LEVELS, formatDate, formatDateTime, formatINR } from '../../utils/format';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import Modal, { Drawer } from '../../components/Modal';
import { Checkbox, Field, Input, Select, Textarea } from '../../components/Field';
import { riskLabel } from '../../components/RiskOMeter';
import { Alert, Async, EmptyState, ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import { NFO_CATEGORIES, nfoCategoryLabel, nfoStatusText } from '../public/parts/Nfo';
import { fieldErrors, useDebounced } from './parts/common';
import { DetailList, PageTitle, RowButton } from './parts/ui';

const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'closed', label: 'Closed' },
];
const STATUS_TONE = { OPEN: 'success', UPCOMING: 'info', CLOSED: '' };
const riskOpts = RISK_LEVELS.map((r) => ({ value: r, label: riskLabel(r) }));
const MAX_PDF = 10 * 1024 * 1024;
const SOURCE_LABEL = { AMFI: 'AMFI', SSD: 'Scheme summary document', STAFF: 'Staff' };

const formatBytes = (b) => (b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Client-side check before upload (the server checks again): PDF type / extension, ≤ 10 MB, starts with "%PDF-". */
async function checkPdf(file) {
  if (!file) return 'Choose the one-pager PDF.';
  if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) return 'Only PDF files are accepted.';
  if (file.size > MAX_PDF) return 'The one-pager must be 10 MB or smaller.';
  if (!file.size) return 'This file is empty.';
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...head) !== '%PDF-') return 'This file is not a valid PDF.';
  } catch {
    /* the server checks the magic bytes as well */
  }
  return null;
}

export default function NfoAdmin() {
  useTitle('New fund offers');
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const dq = useDebounced(q.trim());
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [confirmFetch, setConfirmFetch] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const list = useApi(() => adminApi.nfos({ status, q: dq }), [status, dq]);

  const setStatus = (v) => {
    const p = new URLSearchParams(params);
    if (v) p.set('status', v);
    else p.delete('status');
    setParams(p, { replace: true });
  };

  const fetchNow = async () => {
    setConfirmFetch(false);
    setFetching(true);
    setLastRun(null);
    try {
      const r = await adminApi.syncNfos();
      setLastRun(r);
      if (r.status === 'FAILED') toast.error(`NFO import failed. ${r.errors?.[0] || ''}`);
      else toast.success(`NFO import: ${r.summary || r.status.toLowerCase()}`);
      list.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setFetching(false);
    }
  };

  const onSaved = (d) => {
    list.setData((rows) => (rows || []).map((r) => (r.id === d.id ? d : r)));
  };

  const columns = [
    {
      key: 'schemeName',
      header: 'NFO',
      primary: true,
      render: (r) => (
        <span>
          <strong>{r.schemeName}</strong>
          <span className="tiny muted con-kyc-ref">{r.amc}</span>
        </span>
      ),
    },
    { key: 'assetClass', header: 'Category', render: (r) => <span className="small">{nfoCategoryLabel(r.assetClass)}{r.subCategory && <span className="muted"> · {r.subCategory}</span>}</span> },
    { key: 'openDate', header: 'Opens', render: (r) => formatDate(r.openDate) },
    {
      key: 'closesBy',
      header: 'Closes',
      render: (r) => (
        <span>
          {formatDate(r.closesBy)}
          {!r.closeDateConfirmed && <span className="tiny muted con-kyc-ref">estimated (max 15 days)</span>}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <span className={`chip ${STATUS_TONE[r.status] ? `chip--${STATUS_TONE[r.status]}` : ''}`} title={nfoStatusText(r)}>{r.status === 'OPEN' ? 'Open' : r.status === 'UPCOMING' ? 'Upcoming' : 'Closed'}</span> },
    { key: 'hasOnePager', header: 'One-pager', render: (r) => (r.hasOnePager ? <span className="chip chip--success">Yes</span> : <span className="muted small">No</span>) },
    {
      key: 'flags',
      header: 'Shown',
      render: (r) => (
        <span className="row" style={{ gap: '0.3rem' }}>
          {r.hidden ? <span className="chip chip--danger">Hidden</span> : <span className="small">Public</span>}
          {r.featured && <span className="chip chip--gold">Featured</span>}
          {r.source === 'MANUAL' && <span className="chip">Manual</span>}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      mobile: false,
      render: (r) => (
        <RowButton variant="outline" onClick={() => setSelectedId(r.id)} aria-label={`${isAdmin ? 'Edit' : 'View'} ${r.schemeName}`}>
          <Icon name={isAdmin ? 'edit' : 'file'} size={16} /> {isAdmin ? 'Edit' : 'View'}
        </RowButton>
      ),
    },
  ];

  return (
    <div className="stack-lg">
      <PageTitle eyebrow={isAdmin ? 'Administration' : 'Staff console'} title="New fund offers">
        {isAdmin && (
          <>
            <Button variant="outline" onClick={() => setConfirmFetch(true)} loading={fetching}>
              <Icon name="sync" size={18} /> Fetch latest NFOs
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} /> Add NFO
            </Button>
          </>
        )}
      </PageTitle>
      <p className="small muted" style={{ marginTop: '-1rem' }}>
        NFOs of all fund houses are imported every morning from the AMFI scheme master, with the risk-o-meter, benchmark and fund managers once the AMC files its Scheme Summary Document.{' '}
        {isAdmin
          ? 'Correct any detail, add the close date when the AMC announces it, upload the AMC’s one-pager and feature or hide NFOs here — the daily import never overwrites what you change.'
          : 'This list is read-only for relationship managers; an admin can edit NFOs.'}
      </p>
      {fetching && (
        <Alert type="info" title="Fetching the latest NFOs…">
          Downloading the AMFI scheme master and scheme summary details. This takes up to a minute.
        </Alert>
      )}
      {lastRun && (
        <Alert type={lastRun.status === 'SUCCESS' ? 'success' : lastRun.status === 'PARTIAL' ? 'warning' : 'error'} title={`NFO import: ${lastRun.status.toLowerCase()}`}>
          {lastRun.summary || lastRun.errors?.[0]}
        </Alert>
      )}

      <div className="card con-filters con-kyc-filters" role="search" aria-label="Filter NFOs">
        <div className="con-kyc-chips" role="group" aria-label="Status">
          {STATUS_CHIPS.map((c) => (
            <button key={c.value || 'all'} type="button" className="con-filter-chip" aria-pressed={status === c.value} onClick={() => setStatus(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
        <Field label="Search" hint="Scheme, fund house, category or AMFI code">
          <Input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              const p = new URLSearchParams(params);
              if (e.target.value.trim()) p.set('q', e.target.value.trim());
              else p.delete('q');
              setParams(p, { replace: true });
            }}
            placeholder="Search NFOs"
          />
        </Field>
      </div>

      <Async
        state={list}
        skeleton={<SkeletonBlock rows={6} height={28} />}
        empty={(d) => !d.length}
        emptyView={
          <EmptyState title={status || dq ? 'No NFOs match your filters' : 'No NFOs yet'} icon="briefcase" action={isAdmin && !status && !dq ? <Button variant="outline" onClick={() => setConfirmFetch(true)}>Fetch latest NFOs</Button> : null}>
            {!status && !dq ? 'The daily import adds NFOs from AMFI; you can also add one by hand.' : null}
          </EmptyState>
        }
      >
        {(rows) => (
          <>
            <p className="small muted" aria-live="polite">
              {rows.length} NFO{rows.length === 1 ? '' : 's'}
            </p>
            <DataTable
              caption="New fund offers"
              columns={columns}
              rows={rows}
              onRowClick={(r) => setSelectedId(r.id)}
              rowLabel={(r) => `${isAdmin ? 'Edit' : 'View'} ${r.schemeName}`}
              highlight={(r) => r.status === 'OPEN' && !r.hasOnePager && !r.hidden}
            />
            {isAdmin && <p className="tiny muted">Highlighted: open NFOs without a one-pager.</p>}
          </>
        )}
      </Async>

      <NfoDrawer id={selectedId} isAdmin={isAdmin} onClose={() => setSelectedId(null)} onSaved={onSaved} />
      {isAdmin && (
        <AddNfoModal
          open={adding}
          onClose={() => setAdding(false)}
          onCreated={(d) => {
            setAdding(false);
            list.setData((rows) => [d, ...(rows || [])]);
            toast.success(`${d.schemeName} added.`);
            setSelectedId(d.id);
          }}
        />
      )}
      <ConfirmDialog open={confirmFetch} title="Fetch the latest NFOs now?" confirmLabel="Fetch now" onClose={() => setConfirmFetch(false)} onConfirm={fetchNow}>
        <p>This downloads the AMFI scheme master (all fund houses) and the scheme summary details of new NFOs. Your corrections are kept. It runs every morning on its own as well.</p>
      </ConfirmDialog>
    </div>
  );
}

const toForm = (d) => ({
  closeDate: d.closeDate || '',
  riskometer: d.riskometer || '',
  benchmark: d.benchmark || '',
  fundManagers: d.fundManagers || '',
  exitLoad: d.exitLoad || '',
  objective: d.objective || '',
  sidUrl: d.sidUrl || '',
  featured: !!d.featured,
  hidden: !!d.hidden,
});

function NfoDrawer({ id, isAdmin, onClose, onSaved }) {
  const toast = useToast();
  const q = useApi(() => adminApi.nfo(id), [id], { enabled: !!id });
  const d = q.data && q.data.id === id ? q.data : null;
  const [form, setForm] = useState(toForm({}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (d) {
      setForm(toForm(d));
      setError(null);
      setFileError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id, d?.updatedAt]);

  if (!id) return null;
  const errs = fieldErrors(error);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const update = (saved, msg) => {
    q.setData(saved);
    onSaved(saved);
    if (msg) toast.success(msg);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const base = toForm(d);
    const body = {};
    Object.keys(form).forEach((k) => {
      if (form[k] !== base[k]) body[k] = typeof form[k] === 'string' ? form[k].trim() || null : form[k];
    });
    if (!Object.keys(body).length) {
      setSaving(false);
      toast.success('No changes to save.');
      return;
    }
    try {
      update(await adminApi.updateNfo(d.id, body), `${d.schemeName} updated.`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    setFileError('');
    if (!file) return;
    const bad = await checkPdf(file);
    if (bad) {
      setFileError(bad);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      update(await adminApi.uploadNfoOnePager(d.id, file), 'One-pager uploaded.');
    } catch (err) {
      setFileError(friendlyError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeOnePager = async () => {
    setRemoving(true);
    try {
      update(await adminApi.deleteNfoOnePager(d.id), 'One-pager removed.');
      setConfirmRemove(false);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setRemoving(false);
    }
  };

  const edited = d?.staffEditedFields || [];
  return (
    <Drawer
      open={!!id}
      title={d ? d.schemeName : 'NFO'}
      onClose={onClose}
      footer={
        d && (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Close
            </Button>
            {isAdmin && (
              <Button type="submit" form="con-nfo-form" loading={saving}>
                Save
              </Button>
            )}
          </>
        )
      }
    >
      {!d ? (
        q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : <SkeletonBlock rows={8} />
      ) : (
        <div className="stack-lg">
          <div className="row">
            <span className={`chip ${STATUS_TONE[d.status] ? `chip--${STATUS_TONE[d.status]}` : ''}`}>{nfoStatusText(d)}</span>
            {d.hidden && <span className="chip chip--danger">Hidden</span>}
            {d.featured && <span className="chip chip--gold">Featured</span>}
            <span className="chip">{d.source === 'MANUAL' ? 'Added by staff' : 'From AMFI'}</span>
          </div>
          <DetailList
            items={[
              ['Fund house', d.amc],
              ['AMC (AMFI)', d.amcLegalName],
              ['Category', [nfoCategoryLabel(d.assetClass), d.subCategory].filter(Boolean).join(' · ')],
              ['AMFI category', d.amfiCategory],
              ['AMFI code', d.schemeCode ? <span className="num">{d.schemeCode}</span> : null],
              ['Opens', formatDate(d.openDate)],
              ['Closes', d.closeDateConfirmed ? `${formatDate(d.closeDate)} (${SOURCE_LABEL[d.closeDateSource] || d.closeDateSource || '—'})` : `On or before ${formatDate(d.closesBy)} (estimated)`],
              ['Minimum', d.minAmount != null ? `${formatINR(d.minAmount, { decimals: 0 })}${d.minAmountText ? ` — ${d.minAmountText}` : ''}` : d.minAmountText],
              ['Edited by staff', edited.length ? edited.join(', ') : 'Nothing yet'],
              ['Last updated', formatDateTime(d.updatedAt)],
            ]}
          />

          <section aria-labelledby="con-nfo-op" className="stack">
            <h3 id="con-nfo-op" className="con-h3" style={{ margin: 0 }}>
              One-pager (NFO leaflet)
            </h3>
            {d.hasOnePager ? (
              <div className="row row--between" style={{ gap: '0.5rem 1rem', flexWrap: 'wrap' }}>
                <span className="con-kyc-docs__name">
                  <strong className="pub-break">{d.onePagerFileName || 'one-pager.pdf'}</strong>
                  <span className="tiny muted">
                    {formatBytes(d.onePagerSize)} · uploaded {formatDateTime(d.onePagerUpdatedAt)}
                  </span>
                </span>
                <span className="row" style={{ gap: '0.5rem' }}>
                  <Button variant="outline" size="sm" onClick={() => adminApi.nfoOnePager(d.id, d.onePagerFileName).catch((err) => toast.error(friendlyError(err)))}>
                    <Icon name="download" size={16} /> Download
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
                      <Icon name="trash" size={16} /> Remove
                    </Button>
                  )}
                </span>
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                No one-pager yet. AMCs publish it on their website when the NFO is announced.
              </p>
            )}
            {isAdmin && (
              <Field label={d.hasOnePager ? 'Replace the one-pager' : 'Upload the one-pager'} hint="PDF only, up to 10 MB. Shown on the website as “Download one-pager”." error={fileError}>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="input con-file" onChange={onFile} disabled={uploading} />
              </Field>
            )}
            {uploading && <p className="small muted">Uploading…</p>}
            {confirmRemove && (
              <Alert
                type="warning"
                title="Remove the one-pager?"
                action={
                  <span className="row" style={{ gap: '0.4rem' }}>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)} disabled={removing}>
                      Cancel
                    </Button>
                    <Button variant="danger" size="sm" onClick={removeOnePager} loading={removing}>
                      Remove
                    </Button>
                  </span>
                }
              >
                The “Download one-pager” button disappears from the website until you upload a new file.
              </Alert>
            )}
          </section>

          {isAdmin ? (
            <form id="con-nfo-form" className="stack" onSubmit={save} noValidate aria-label="Edit NFO">
              {error && <Alert type="error">{friendlyError(error)}</Alert>}
              <Field label="Close date" error={errs.closeDate} hint="Leave empty while the AMC has not announced it — the site then shows “on or before” open date + 15 days.">
                <Input type="date" value={form.closeDate} min={d.openDate} onChange={set('closeDate')} />
              </Field>
              <Field label="Riskometer" error={errs.riskometer}>
                <Select value={form.riskometer} onChange={set('riskometer')} placeholder="Not published yet" options={riskOpts} />
              </Field>
              <Field label="Benchmark" error={errs.benchmark}>
                <Input value={form.benchmark} onChange={set('benchmark')} maxLength={150} />
              </Field>
              <Field label="Fund managers" error={errs.fundManagers} hint="Comma separated">
                <Input value={form.fundManagers} onChange={set('fundManagers')} maxLength={300} />
              </Field>
              <Field label="Exit load" error={errs.exitLoad}>
                <Textarea rows={3} value={form.exitLoad} onChange={set('exitLoad')} maxLength={1000} />
              </Field>
              <Field label="Investment objective" error={errs.objective}>
                <Textarea rows={4} value={form.objective} onChange={set('objective')} maxLength={2000} />
              </Field>
              <Field label="Scheme Information Document (SID) link" error={errs.sidUrl} hint="https://… on the AMC’s website">
                <Input type="url" value={form.sidUrl} onChange={set('sidUrl')} maxLength={300} placeholder="https://" />
              </Field>
              <div className="stack" style={{ gap: '0.5rem' }}>
                <Checkbox label="Featured — shown first on the website and the home page" checked={form.featured} onChange={set('featured')} />
                <Checkbox label="Hidden — not shown on the website" checked={form.hidden} onChange={set('hidden')} />
              </div>
              <p className="tiny muted" style={{ margin: 0 }}>
                Fields you change here are marked as edited by staff; the daily import will not overwrite them.
              </p>
            </form>
          ) : (
            <DetailList
              items={[
                ['Riskometer', d.riskometer ? riskLabel(d.riskometer) : null],
                ['Benchmark', d.benchmark],
                ['Fund managers', d.fundManagers],
                ['Exit load', d.exitLoad],
                ['Objective', d.objective],
                ['SID', d.sidUrl ? <a href={d.sidUrl} target="_blank" rel="noopener noreferrer">{d.sidUrl}</a> : null],
              ]}
            />
          )}
          <p className="small" style={{ margin: 0 }}>
            <a href={`/nfo/${d.id}`} target="_blank" rel="noopener noreferrer">
              View on the website<span className="sr-only"> (opens in new tab)</span>
            </a>
          </p>
        </div>
      )}
    </Drawer>
  );
}

const EMPTY_NEW = { amc: '', schemeName: '', assetClass: '', subCategory: '', openDate: '', closeDate: '', minAmount: '', sidUrl: '' };

function AddNfoModal({ open, onClose, onCreated }) {
  const [f, setF] = useState(EMPTY_NEW);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setF(EMPTY_NEW);
      setError(null);
    }
  }, [open]);
  const errs = fieldErrors(error);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {};
    Object.entries(f).forEach(([k, v]) => {
      if (String(v).trim()) body[k] = String(v).trim();
    });
    try {
      onCreated(await adminApi.createNfo(body));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      title="Add an NFO"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="con-nfo-new" loading={busy}>
            Add NFO
          </Button>
        </>
      }
    >
      <form id="con-nfo-new" className="stack" onSubmit={submit} noValidate>
        <p className="small muted" style={{ margin: 0 }}>
          For an NFO the AMC has announced but AMFI does not list yet. You can add the risk-o-meter, benchmark and one-pager after saving.
        </p>
        {error && <Alert type="error">{friendlyError(error)}</Alert>}
        <div className="form-grid form-grid--2">
          <Field label="Fund house (AMC)" error={errs.amc} required hint="As shown on the site, e.g. HDFC Mutual Fund">
            <Input value={f.amc} onChange={set('amc')} maxLength={150} />
          </Field>
          <Field label="Scheme name" error={errs.schemeName} required>
            <Input value={f.schemeName} onChange={set('schemeName')} maxLength={250} />
          </Field>
          <Field label="Category" error={errs.assetClass} required>
            <Select value={f.assetClass} onChange={set('assetClass')} placeholder="Choose" options={NFO_CATEGORIES} />
          </Field>
          <Field label="Sub-category" error={errs.subCategory} hint="e.g. Flexi Cap, Index, Liquid">
            <Input value={f.subCategory} onChange={set('subCategory')} maxLength={60} />
          </Field>
          <Field label="Opens on" error={errs.openDate} required>
            <Input type="date" value={f.openDate} onChange={set('openDate')} />
          </Field>
          <Field label="Closes on" error={errs.closeDate} hint="Optional">
            <Input type="date" value={f.closeDate} min={f.openDate || undefined} onChange={set('closeDate')} />
          </Field>
          <Field label="Minimum investment (₹)" error={errs.minAmount}>
            <Input type="number" inputMode="decimal" min="0" value={f.minAmount} onChange={set('minAmount')} />
          </Field>
          <Field label="SID link" error={errs.sidUrl}>
            <Input type="url" value={f.sidUrl} onChange={set('sidUrl')} placeholder="https://" maxLength={300} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
