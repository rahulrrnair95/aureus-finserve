import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { useTitle } from '../../utils/useTitle';
import { useAuth } from '../../auth/AuthContext';
import { formatINR, humanize } from '../../utils/format';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import { Field, Input, Select } from '../../components/Field';
import { Async, EmptyState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import Icon from '../../components/Icon';
import { useDebounced } from './parts/common';
import { PageTitle } from './parts/ui';
import ClientFormModal from './parts/ClientFormModal';

export default function Clients() {
  useTitle('Clients');
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const rmId = params.get('rmId') || '';
  const dq = useDebounced(q.trim());
  const [creating, setCreating] = useState(false);

  const list = useApi(() => adminApi.clients({ q: dq, rmId: isAdmin ? rmId : undefined }), [dq, rmId]);
  const rms = useApi(() => adminApi.rms(), [], { enabled: isAdmin });

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const columns = [
    {
      key: 'name',
      header: 'Client',
      primary: true,
      render: (r) => (
        <Link to={`/console/clients/${r.id}`} onClick={(e) => e.stopPropagation()}>
          {r.name}
        </Link>
      ),
    },
    { key: 'panMasked', header: 'PAN', render: (r) => <span className="num">{r.panMasked || '—'}</span> },
    { key: 'mobileMasked', header: 'Mobile', render: (r) => <span className="num">{r.mobileMasked || '—'}</span> },
    { key: 'rmName', header: 'RM', render: (r) => r.rmName || <span className="muted">Unassigned</span> },
    { key: 'aum', header: 'AUM', num: true, render: (r) => formatINR(r.aum, { decimals: 0 }) },
    { key: 'sipCount', header: 'SIPs', num: true },
    { key: 'kycStatus', header: 'KYC', render: (r) => <StatusChip status={r.kycStatus} /> },
    { key: 'loginStatus', header: 'Login', render: (r) => <StatusChip status={r.loginStatus} /> },
    {
      key: 'family',
      header: 'Family',
      render: (r) =>
        r.familyHeadId && r.familyHeadId !== r.id ? (
          <span>
            {humanize(r.relation)} of {r.familyHeadName}
          </span>
        ) : (
          <span className="muted">Family head</span>
        ),
    },
  ];

  return (
    <div className="stack-lg">
      <PageTitle title="Clients">
        <Button onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} /> New client
        </Button>
      </PageTitle>

      <div className="card con-filters" role="search" aria-label="Filter clients">
        <Field label="Search" hint="Name, PAN, email or mobile">
          <Input type="search" value={q} onChange={(e) => {
            setQ(e.target.value);
            setParam('q', e.target.value.trim());
          }} placeholder="Search clients" />
        </Field>
        {isAdmin && (
          <Field label="Relationship manager">
            <Select value={rmId} onChange={(e) => setParam('rmId', e.target.value)} placeholder="All RMs" options={(rms.data || []).map((r) => ({ value: String(r.id), label: r.name }))} />
          </Field>
        )}
      </div>

      <section aria-label="Client list">
        <Async
          state={list}
          skeleton={<SkeletonBlock rows={6} height={28} />}
          empty={(d) => !d.length}
          emptyView={
            <EmptyState title={dq || rmId ? 'No clients match your filters' : 'No clients yet'} icon="users" action={<Button variant="outline" onClick={() => setCreating(true)}>Add a client</Button>} />
          }
        >
          {(rows) => (
            <>
              <p className="small muted" aria-live="polite">
                {rows.length} client{rows.length === 1 ? '' : 's'}
              </p>
              <DataTable caption="Clients" columns={columns} rows={rows} onRowClick={(r) => navigate(`/console/clients/${r.id}`)} rowLabel={(r) => `Open client ${r.name}`} />
            </>
          )}
        </Async>
      </section>

      <ClientFormModal open={creating} onClose={() => setCreating(false)} isAdmin={isAdmin} onSaved={() => list.reload()} />
    </div>
  );
}
