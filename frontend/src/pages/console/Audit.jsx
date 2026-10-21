import { useEffect, useState } from 'react';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { formatDateTime, formatNumber, humanize } from '../../utils/format';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import { Field, Input, Select } from '../../components/Field';
import { Alert, Async, EmptyState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { Pagination } from '../../components/Misc';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import { AUDIT_ACTIONS, useDebounced } from './parts/common';
import { PageTitle } from './parts/ui';

const SIZE = 50;

export default function Audit() {
  useTitle('Audit log');
  const toast = useToast();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const dq = useDebounced(q.trim());

  useEffect(() => setPage(0), [dq, action, from, to]);

  const list = useApi(() => adminApi.audit({ q: dq, action, from, to, page, size: SIZE }), [dq, action, from, to, page]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await adminApi.auditExport();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { key: 'at', header: 'When', primary: true, render: (r) => <span className="nowrap">{formatDateTime(r.at)}</span> },
    { key: 'userName', header: 'User', render: (r) => r.userName || <span className="muted">—</span> },
    { key: 'role', header: 'Role', render: (r) => (r.role ? humanize(r.role) : '—') },
    { key: 'action', header: 'Action', render: (r) => <span className="chip">{humanize(r.action)}</span> },
    { key: 'entity', header: 'Entity', render: (r) => (r.entity ? `${r.entity}${r.entityId != null ? ` #${r.entityId}` : ''}` : '—') },
    { key: 'detail', header: 'Detail', render: (r) => <span className="con-detail">{r.detail || '—'}</span> },
    { key: 'ip', header: 'IP', render: (r) => <span className="num">{r.ip || '—'}</span> },
  ];

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Administration" title="Audit log">
        <Button variant="outline" onClick={exportCsv} loading={exporting}>
          <Icon name="download" size={18} /> Export CSV
        </Button>
      </PageTitle>
      <Alert type="info">Audit records cannot be edited or deleted.</Alert>

      <div className="card con-filters" role="search" aria-label="Filter audit log">
        <Field label="Search" hint="User, entity or detail">
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field label="Action">
          <Select value={action} onChange={(e) => setAction(e.target.value)} placeholder="All" options={AUDIT_ACTIONS.map((a) => ({ value: a, label: humanize(a) }))} />
        </Field>
        <Field label="From">
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <Async state={list} skeleton={<SkeletonBlock rows={8} height={26} />} empty={(d) => !d.items?.length} emptyView={<EmptyState title="No audit records match" icon="list" />}>
        {(d) => (
          <>
            <p className="small muted" aria-live="polite">
              {formatNumber(d.total)} record{d.total === 1 ? '' : 's'}
              {list.loading ? ' — loading…' : ''}
            </p>
            <DataTable caption="Audit records" columns={columns} rows={d.items} />
            <Pagination page={page} size={SIZE} total={d.total} onChange={(p) => { setPage(p); window.scrollTo({ top: 0 }); }} />
          </>
        )}
      </Async>
    </div>
  );
}
