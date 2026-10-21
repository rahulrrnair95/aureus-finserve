import { useState } from 'react';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi } from '../../api/endpoints';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import { Drawer } from '../../components/Modal';
import Icon from '../../components/Icon';
import StatusChip from '../../components/StatusChip';
import { Async, EmptyState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { formatDateTime } from '../../utils/format';
import { FilterChips, InfoList, PageTitle, categoryLabel } from './parts/common';
import TicketModal from './parts/TicketModal';

export default function ServiceRequests() {
  useTitle('Service requests');
  const toast = useToast();
  const q = useApi(() => investorApi.tickets(), []);
  const [creating, setCreating] = useState(false);
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState('OPEN_ALL');

  const columns = [
    {
      key: 'subject',
      header: 'Request',
      primary: true,
      render: (t) => (
        <span>
          <strong>{t.subject}</strong>
          <br />
          <span className="tiny muted num">{t.ref}</span>
        </span>
      ),
    },
    { key: 'category', header: 'Category', render: (t) => categoryLabel(t.category) },
    { key: 'status', header: 'Status', render: (t) => <StatusChip status={t.status} /> },
    { key: 'updatedAt', header: 'Last updated', render: (t) => formatDateTime(t.updatedAt || t.createdAt) },
  ];

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Account" title="Service requests">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} /> New request
        </Button>
      </PageTitle>
      <p className="small muted" style={{ marginTop: '-0.75rem' }}>
        Raise requests for address, bank or nominee changes, missing transactions or statements. Our service team responds within the timelines in our grievance policy.
      </p>
      <Async
        state={q}
        skeleton={<SkeletonBlock rows={6} height={22} />}
        empty={(d) => !d?.length}
        emptyView={
          <div className="card">
            <EmptyState title="No service requests" icon="ticket" action={<Button onClick={() => setCreating(true)}>Raise a request</Button>}>
              Need help with your account? Raise a request and track it here.
            </EmptyState>
          </div>
        }
      >
        {(list) => {
          const open = list.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
          const shown = filter === 'OPEN_ALL' ? list : filter === 'OPEN' ? open : list.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');
          return (
            <section className="card" aria-labelledby="inv-sr-h">
              <div className="card__head">
                <h2 id="inv-sr-h" className="card__title">
                  Your requests
                </h2>
                <FilterChips
                  label="Filter requests"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'OPEN_ALL', label: 'All', count: list.length },
                    { value: 'OPEN', label: 'Open', count: open.length },
                    { value: 'DONE', label: 'Resolved / closed', count: list.length - open.length },
                  ]}
                />
              </div>
              {shown.length ? (
                <DataTable caption="Service requests" columns={columns} rows={shown} rowKey="id" onRowClick={setSel} rowLabel={(t) => `${t.ref}: ${t.subject}, ${t.status}. View details`} />
              ) : (
                <EmptyState title="No requests with this status" icon="ticket" />
              )}
            </section>
          );
        }}
      </Async>

      <TicketModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(t) => {
          setCreating(false);
          if (t && t.id) q.setData((l) => [t, ...(l || [])]);
          else q.reload();
          toast.success(`Request ${t?.ref || ''} raised. We’ll keep you updated here.`);
        }}
      />

      {sel && (
        <Drawer open title={sel.subject} onClose={() => setSel(null)}>
          <div className="stack-lg">
            <InfoList
              items={[
                { label: 'Reference', value: <span className="num">{sel.ref}</span> },
                { label: 'Category', value: categoryLabel(sel.category) },
                { label: 'Status', value: <StatusChip status={sel.status} /> },
                { label: 'Raised', value: formatDateTime(sel.createdAt) },
                { label: 'Last updated', value: formatDateTime(sel.updatedAt) },
              ]}
            />
            <section aria-labelledby="inv-sr-desc">
              <h3 id="inv-sr-desc">Description</h3>
              <p className="inv-pre">{sel.description || '—'}</p>
            </section>
            <section aria-labelledby="inv-sr-thread">
              <h3 id="inv-sr-thread">Updates</h3>
              {sel.comments?.length ? (
                <ol className="inv-thread">
                  {sel.comments.map((c, i) => (
                    <li key={`${c.at}-${i}`} className="inv-thread__item">
                      <div className="row row--between">
                        <strong className="small">{c.by}</strong>
                        <span className="tiny muted">{formatDateTime(c.at)}</span>
                      </div>
                      <p className="inv-pre small" style={{ margin: '0.25rem 0 0' }}>
                        {c.text}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="small muted">No updates yet. Our team will respond here.</p>
              )}
            </section>
          </div>
        </Drawer>
      )}
    </div>
  );
}
