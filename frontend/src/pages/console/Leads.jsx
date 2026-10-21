import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { useAuth } from '../../auth/AuthContext';
import { formatDate, formatDateTime, humanize } from '../../utils/format';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import { Drawer } from '../../components/Modal';
import { Field, Input, Select, Textarea } from '../../components/Field';
import { Alert, Async, EmptyState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import { LEAD_STATUSES, fieldErrors, opts, useDebounced } from './parts/common';
import { DetailList, PageTitle, RowButton } from './parts/ui';

const SOURCES = ['WEBSITE', 'PORTFOLIO_REVIEW'];

export default function Leads() {
  useTitle('Leads');
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const source = params.get('source') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const dq = useDebounced(q.trim());
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const list = useApi(() => adminApi.leads({ status, q: dq }), [status, dq]);
  const rms = useApi(() => adminApi.rms(), [], { enabled: isAdmin });

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const download = async (lead) => {
    setDownloading(lead.id);
    try {
      await adminApi.leadAttachment(lead.id);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setDownloading(null);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Lead',
      primary: true,
      render: (r) => (
        <span>
          <strong>{r.name}</strong>
          {r.hasAttachment && (
            <span className="chip chip--info con-chip-sm" title="CAS statement attached">
              <Icon name="file" size={14} /> CAS
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'mobile',
      header: 'Mobile',
      render: (r) => (
        <a href={`tel:${r.mobile}`} className="num" onClick={(e) => e.stopPropagation()}>
          {r.mobile}
        </a>
      ),
    },
    { key: 'email', header: 'Email', render: (r) => (r.email ? <a href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()}>{r.email}</a> : '—') },
    { key: 'city', header: 'City' },
    { key: 'interest', header: 'Interest', render: (r) => humanize(r.interest) },
    { key: 'source', header: 'Source', render: (r) => humanize(r.source) },
    { key: 'createdAt', header: 'Received', render: (r) => formatDate(r.createdAt) },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { key: 'followUpDate', header: 'Follow-up', render: (r) => (r.followUpDate ? formatDate(r.followUpDate) : '—') },
    { key: 'assignedRmName', header: 'RM', render: (r) => r.assignedRmName || <span className="muted">Unassigned</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (r) => (
        <div className="row con-row-actions">
          <RowButton variant="outline" onClick={() => setSelected(r)} aria-label={`Update lead ${r.name}`}>
            <Icon name="edit" size={16} /> Update
          </RowButton>
          {r.hasAttachment && (
            <RowButton variant="ghost" loading={downloading === r.id} onClick={() => download(r)} aria-label={`Download CAS for ${r.name}`}>
              <Icon name="download" size={16} /> CAS
            </RowButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="stack-lg">
      <PageTitle title="Leads" />
      <div className="card con-filters" role="search" aria-label="Filter leads">
        <Field label="Search" hint="Name, mobile, email or city">
          <Input type="search" value={q} onChange={(e) => { setQ(e.target.value); setParam('q', e.target.value.trim()); }} placeholder="Search leads" />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setParam('status', e.target.value)} placeholder="All statuses" options={opts(LEAD_STATUSES)} />
        </Field>
        <Field label="Source">
          <Select value={source} onChange={(e) => setParam('source', e.target.value)} placeholder="All sources" options={opts(SOURCES)} />
        </Field>
      </div>

      <Async state={list} skeleton={<SkeletonBlock rows={6} height={28} />} empty={(d) => !d.length} emptyView={<EmptyState title={status || dq ? 'No leads match your filters' : 'No leads yet'} icon="inbox" />}>
        {(all) => {
          const rows = source ? all.filter((r) => r.source === source) : all;
          if (!rows.length) return <EmptyState title="No leads from this source" icon="inbox" />;
          return (
            <>
              <p className="small muted" aria-live="polite">
                {rows.length} lead{rows.length === 1 ? '' : 's'}
              </p>
              <DataTable caption="Leads" columns={columns} rows={rows} onRowClick={setSelected} rowLabel={(r) => `Update lead ${r.name}`} />
            </>
          );
        }}
      </Async>

      <LeadDrawer
        lead={selected}
        isAdmin={isAdmin}
        rms={rms.data || []}
        downloading={selected && downloading === selected.id}
        onDownload={download}
        onClose={() => setSelected(null)}
        onSaved={(saved) => {
          list.setData((rows) => (rows || []).map((r) => (r.id === saved.id ? { ...r, ...saved } : r)));
          setSelected(null);
          toast.success(`Lead ${saved.name || ''} updated.`);
        }}
      />
    </div>
  );
}

function LeadDrawer({ lead, isAdmin, rms, onClose, onSaved, onDownload, downloading }) {
  const [form, setForm] = useState({ status: 'NEW', followUpDate: '', notes: '', assignedRmId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (lead) {
      setForm({ status: lead.status || 'NEW', followUpDate: lead.followUpDate || '', notes: lead.notes || '', assignedRmId: lead.assignedRmId ? String(lead.assignedRmId) : '' });
      setError(null);
    }
  }, [lead]);

  if (!lead) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const errs = fieldErrors(error);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { status: form.status, followUpDate: form.followUpDate || null, notes: form.notes };
    if (isAdmin) body.assignedRmId = form.assignedRmId ? Number(form.assignedRmId) : null;
    try {
      const saved = await adminApi.updateLead(lead.id, body);
      onSaved({ ...lead, ...saved });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={!!lead}
      title={lead.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="con-lead-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack-lg">
        <DetailList
          items={[
            ['Mobile', <a href={`tel:${lead.mobile}`}>{lead.mobile}</a>],
            ['Email', lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : null],
            ['City', lead.city],
            ['Interest', humanize(lead.interest)],
            ['Source', humanize(lead.source)],
            ['Received', formatDateTime(lead.createdAt)],
            ['Message', lead.message],
          ]}
        />
        {lead.hasAttachment && (
          <div className="row">
            <Button variant="outline" size="sm" loading={downloading} onClick={() => onDownload(lead)}>
              <Icon name="download" size={16} /> Download CAS
            </Button>
            <span className="tiny muted">Downloads are recorded in the audit log.</span>
          </div>
        )}
        <form id="con-lead-form" className="stack" onSubmit={save} noValidate>
          {error && <Alert type="error">{friendlyError(error)}</Alert>}
          <Field label="Status" error={errs.status}>
            <Select value={form.status} onChange={set('status')} options={opts(LEAD_STATUSES)} />
          </Field>
          <Field label="Follow-up date" error={errs.followUpDate}>
            <Input type="date" value={form.followUpDate} onChange={set('followUpDate')} />
          </Field>
          <Field label="Notes" error={errs.notes}>
            <Textarea rows={4} value={form.notes} onChange={set('notes')} />
          </Field>
          {isAdmin && (
            <Field label="Assigned RM" error={errs.assignedRmId}>
              <Select value={form.assignedRmId} onChange={set('assignedRmId')} placeholder="Unassigned" options={rms.map((r) => ({ value: String(r.id), label: r.name }))} />
            </Field>
          )}
        </form>
      </div>
    </Drawer>
  );
}
