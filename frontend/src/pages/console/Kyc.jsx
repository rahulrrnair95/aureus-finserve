import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { useAuth } from '../../auth/AuthContext';
import { formatDate, formatDateTime } from '../../utils/format';
import { GENDERS, INCOMES, MARITAL, OCCUPATIONS, formatBytes, kycDocLabel, kycStatusLabel, optionLabel } from '../../utils/kyc';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import { Drawer } from '../../components/Modal';
import { Field, Input, Select, Textarea } from '../../components/Field';
import { Alert, Async, EmptyState, ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import { KYC_APP_STATUSES, KYC_PENDING_STATUSES, fieldErrors, useDebounced } from './parts/common';
import { DetailList, PageTitle, RowButton } from './parts/ui';

const statusOpts = KYC_APP_STATUSES.map((s) => ({ value: s, label: kycStatusLabel(s) }));

export default function KycRequests() {
  useTitle('KYC requests');
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const pending = params.get('pending') === '1';
  const [q, setQ] = useState(params.get('q') || '');
  const dq = useDebounced(q.trim());
  const [selectedId, setSelectedId] = useState(null);

  const list = useApi(() => adminApi.kyc({ status, q: dq }), [status, dq]);
  const rms = useApi(() => adminApi.rms(), [], { enabled: isAdmin });

  const setFilter = (next) => {
    const p = new URLSearchParams(params);
    p.delete('status');
    p.delete('pending');
    if (next === 'PENDING') p.set('pending', '1');
    else if (next) p.set('status', next);
    setParams(p, { replace: true });
  };
  const active = pending ? 'PENDING' : status;
  const chips = [{ value: '', label: 'All' }, { value: 'PENDING', label: 'Pending' }, ...statusOpts];

  const columns = [
    {
      key: 'fullName',
      header: 'Applicant',
      primary: true,
      render: (r) => (
        <span>
          <strong>{r.fullName}</strong>
          <span className="tiny muted con-kyc-ref num">{r.ref}</span>
        </span>
      ),
    },
    { key: 'residency', header: 'Type', render: (r) => <span className={`chip ${r.residency === 'NRI' ? 'chip--navy' : ''}`}>{r.residency === 'NRI' ? 'NRI' : 'Resident'}</span> },
    { key: 'location', header: 'Location', render: (r) => r.location || '—' },
    { key: 'panMasked', header: 'PAN', render: (r) => <span className="num">{r.panMasked}</span> },
    { key: 'mobileMasked', header: 'Mobile', render: (r) => <span className="num">{r.mobileMasked}</span> },
    { key: 'documentCount', header: 'Docs', num: true },
    { key: 'createdAt', header: 'Received', render: (r) => formatDate(r.createdAt) },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} label={kycStatusLabel(r.status)} /> },
    { key: 'assignedRmName', header: 'Owner', render: (r) => r.assignedRmName || <span className="muted">Unassigned</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      mobile: false,
      render: (r) => (
        <RowButton variant="outline" onClick={() => setSelectedId(r.id)} aria-label={`Open KYC request ${r.ref} from ${r.fullName}`}>
          <Icon name="edit" size={16} /> Open
        </RowButton>
      ),
    },
  ];

  return (
    <div className="stack-lg">
      <PageTitle title="KYC requests" />
      <p className="small muted" style={{ marginTop: '-1rem' }}>
        Online KYC applications from the website. Verify the documents, complete the video in-person verification (VIPV), upload to the KRA, then update the status — the applicant is informed by SMS and email.
      </p>
      <div className="card con-filters con-kyc-filters" role="search" aria-label="Filter KYC requests">
        <div className="con-kyc-chips" role="group" aria-label="Status">
          {chips.map((c) => (
            <button key={c.value || 'all'} type="button" className="con-filter-chip" aria-pressed={active === c.value} onClick={() => setFilter(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
        <Field label="Search" hint="Name, reference, email, city / country, or a full PAN or mobile">
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
            placeholder="Search KYC requests"
          />
        </Field>
      </div>

      <Async
        state={list}
        skeleton={<SkeletonBlock rows={6} height={28} />}
        empty={(d) => !d.length}
        emptyView={<EmptyState title={status || dq ? 'No KYC requests match your filters' : 'No KYC requests yet'} icon="shield" />}
      >
        {(all) => {
          const rows = pending ? all.filter((r) => KYC_PENDING_STATUSES.includes(r.status)) : all;
          if (!rows.length) return <EmptyState title="Nothing pending — all caught up" icon="shield" />;
          return (
            <>
              <p className="small muted" aria-live="polite">
                {rows.length} request{rows.length === 1 ? '' : 's'}
              </p>
              <DataTable
                caption="KYC requests"
                columns={columns}
                rows={rows}
                onRowClick={(r) => setSelectedId(r.id)}
                rowLabel={(r) => `Open KYC request ${r.ref} from ${r.fullName}`}
                highlight={(r) => r.status === 'SUBMITTED'}
              />
            </>
          );
        }}
      </Async>

      <KycDrawer
        id={selectedId}
        isAdmin={isAdmin}
        rms={rms.data || []}
        onClose={() => setSelectedId(null)}
        onSaved={(d) => {
          list.setData((rows) => (rows || []).map((r) => (r.id === d.id ? { ...r, status: d.status, assignedRmId: d.assignedRmId, assignedRmName: d.assignedRmName, updatedAt: d.updatedAt } : r)));
          toast.success(`KYC request ${d.ref} updated.`);
        }}
      />
    </div>
  );
}

function KycDrawer({ id, isAdmin, rms, onClose, onSaved }) {
  const toast = useToast();
  const q = useApi(() => adminApi.kycDetail(id), [id], { enabled: !!id });
  const d = q.data && q.data.id === id ? q.data : null;
  const [form, setForm] = useState({ status: 'SUBMITTED', staffNotes: '', assignedRmId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    if (d) {
      setForm({ status: d.status, staffNotes: d.staffNotes || '', assignedRmId: d.assignedRmId ? String(d.assignedRmId) : '' });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id, d?.updatedAt]);

  if (!id) return null;
  const errs = fieldErrors(error);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const download = async (doc) => {
    setDownloading(doc.id);
    try {
      await adminApi.kycDocument(d.id, doc.id, `${d.ref}-${doc.fileName}`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setDownloading(null);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { status: form.status, staffNotes: form.staffNotes };
    if (isAdmin && form.assignedRmId) body.assignedRmId = Number(form.assignedRmId);
    try {
      const saved = await adminApi.updateKyc(d.id, body);
      q.setData(saved);
      onSaved(saved);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const nri = d?.residency === 'NRI';
  return (
    <Drawer
      open={!!id}
      title={d ? `KYC ${d.ref}` : 'KYC request'}
      onClose={onClose}
      footer={
        d && (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Close
            </Button>
            <Button type="submit" form="con-kyc-form" loading={saving}>
              Save
            </Button>
          </>
        )
      }
    >
      {!d ? (
        q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : <SkeletonBlock rows={8} />
      ) : (
        <div className="stack-lg">
          <div className="row">
            <StatusChip status={d.status} label={kycStatusLabel(d.status)} />
            <span className={`chip ${nri ? 'chip--navy' : ''}`}>{nri ? 'NRI' : 'Resident'}</span>
            {d.politicallyExposed && <span className="chip chip--danger">PEP</span>}
          </div>
          <section aria-labelledby="con-kyc-app">
            <h3 id="con-kyc-app" className="con-h3">
              Applicant
            </h3>
            <DetailList
              items={[
                ['Name', d.fullName],
                ['Father / spouse', d.fatherOrSpouseName],
                ['PAN', <span className="num">{d.panMasked}</span>],
                ['Date of birth', d.dobMasked ? `${d.dobMasked} (age ${d.age})` : null],
                ['Gender', optionLabel(GENDERS, d.gender)],
                ['Mobile', <span className="num">{d.mobileMasked}</span>],
                ['Email', d.email ? <a href={`mailto:${d.email}`}>{d.email}</a> : null],
                ['Marital status', optionLabel(MARITAL, d.maritalStatus)],
                ['Occupation', optionLabel(OCCUPATIONS, d.occupation)],
                ['Annual income', optionLabel(INCOMES, d.annualIncome)],
                ['Politically exposed', d.politicallyExposed ? 'Yes' : 'No'],
              ]}
            />
          </section>
          <section aria-labelledby="con-kyc-addr">
            <h3 id="con-kyc-addr" className="con-h3">
              Address
            </h3>
            <DetailList
              items={[
                ...(nri
                  ? [
                      ['Country of residence', d.countryOfResidence],
                      ['Overseas address', d.overseasAddressMasked],
                      ['Tax residence', d.taxResidencyCountry],
                      ['Foreign TIN', d.foreignTinMasked],
                      ['Nationality', d.nationality],
                    ]
                  : []),
                [nri ? 'Indian address' : 'Address', d.addressMasked],
                ['City / state', [d.city, d.state].filter(Boolean).join(', ')],
                ['PIN code', d.pincode],
              ]}
            />
            <p className="tiny muted">Sensitive values are masked here; the full details are in the uploaded documents.</p>
          </section>
          <section aria-labelledby="con-kyc-docs">
            <h3 id="con-kyc-docs" className="con-h3">
              Documents ({d.documents.length})
            </h3>
            {d.documents.length ? (
              <ul className="con-list con-kyc-docs">
                {d.documents.map((doc) => (
                  <li key={doc.id} className="row row--between">
                    <span className="con-kyc-docs__name">
                      <strong>{kycDocLabel(doc.docType, d.residency)}</strong>
                      <span className="tiny muted pub-break">
                        {doc.fileName} · {formatBytes(doc.sizeBytes)}
                      </span>
                    </span>
                    <Button variant="outline" size="sm" loading={downloading === doc.id} onClick={() => download(doc)} aria-label={`Download ${kycDocLabel(doc.docType, d.residency)}`}>
                      <Icon name="download" size={16} /> Download
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">No documents.</p>
            )}
            <p className="tiny muted">Downloads are recorded in the audit log. Delete local copies after the KRA upload.</p>
          </section>
          <DetailList
            items={[
              ['Preferred VIPV slot', d.preferredVipvSlot],
              ['Consent', d.consent ? `Given ${formatDateTime(d.consentAt)}` : 'No'],
              ['Received', formatDateTime(d.createdAt)],
              ['Last updated', formatDateTime(d.updatedAt)],
              ['Owner', d.assignedRmName || 'Unassigned'],
            ]}
          />
          <form id="con-kyc-form" className="stack" onSubmit={save} noValidate aria-label="Update KYC request">
            {error && <Alert type="error">{friendlyError(error)}</Alert>}
            <Field label="Status" error={errs.status} hint="The applicant gets an SMS and email when the status changes.">
              <Select value={form.status} onChange={set('status')} options={statusOpts} />
            </Field>
            <Field label="Staff notes" error={errs.staffNotes} hint="Internal only — not shown to the applicant.">
              <Textarea rows={4} value={form.staffNotes} onChange={set('staffNotes')} maxLength={4000} />
            </Field>
            {isAdmin ? (
              <Field label="Assigned RM" error={errs.assignedRmId}>
                <Select value={form.assignedRmId} onChange={set('assignedRmId')} placeholder="Unassigned" options={rms.map((r) => ({ value: String(r.id), label: r.name }))} />
              </Field>
            ) : (
              !d.assignedRmId && <p className="tiny muted">Saving will assign this request to you.</p>
            )}
          </form>
        </div>
      )}
    </Drawer>
  );
}
