import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { formatDateTime, humanize } from '../../utils/format';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import { Drawer } from '../../components/Modal';
import { Field, Select, Textarea } from '../../components/Field';
import { Alert, Async, EmptyState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { TICKET_STATUSES, fieldErrors, opts } from './parts/common';
import { DetailList, PageTitle } from './parts/ui';

export default function Tickets() {
  useTitle('Service tickets');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [selected, setSelected] = useState(null);
  const list = useApi(() => adminApi.tickets(status), [status]);

  const columns = [
    { key: 'ref', header: 'Ref', primary: true, render: (r) => <span className="num">{r.ref}</span> },
    { key: 'investorName', header: 'Client' },
    { key: 'category', header: 'Category', render: (r) => humanize(r.category) },
    { key: 'subject', header: 'Subject' },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { key: 'updatedAt', header: 'Updated', render: (r) => formatDateTime(r.updatedAt || r.createdAt) },
  ];

  return (
    <div className="stack-lg">
      <PageTitle title="Service tickets" />
      <div className="card con-filters" role="search" aria-label="Filter tickets">
        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set('status', e.target.value);
              else next.delete('status');
              setParams(next, { replace: true });
            }}
            placeholder="All statuses"
            options={opts(TICKET_STATUSES)}
          />
        </Field>
      </div>
      <Async state={list} skeleton={<SkeletonBlock rows={6} height={28} />} empty={(d) => !d.length} emptyView={<EmptyState title={status ? 'No tickets with this status' : 'No service tickets'} icon="ticket" />}>
        {(rows) => <DataTable caption="Service tickets" columns={columns} rows={rows} onRowClick={setSelected} rowLabel={(r) => `Ticket ${r.ref}: ${r.subject}`} highlight={(r) => r.status === 'OPEN'} />}
      </Async>
      <TicketDrawer
        ticket={selected}
        onClose={() => setSelected(null)}
        onSaved={(t) => {
          setSelected(t);
          list.setData((rows) => (rows || []).map((r) => (r.id === t.id ? t : r)));
          toast.success(`Ticket ${t.ref} updated.`);
        }}
      />
    </div>
  );
}

function TicketDrawer({ ticket, onClose, onSaved }) {
  const [form, setForm] = useState({ status: 'OPEN', comment: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ticket) {
      setForm({ status: ticket.status, comment: '' });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id]);

  if (!ticket) return null;
  const errs = fieldErrors(error);

  const submit = async (e) => {
    e.preventDefault();
    if (form.status === ticket.status && !form.comment.trim()) {
      setError({ fields: { comment: 'Change the status or add a comment.' } });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const t = await adminApi.updateTicket(ticket.id, { status: form.status, comment: form.comment.trim() || null });
      onSaved({ ...ticket, ...t });
      setForm((f) => ({ ...f, comment: '' }));
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={!!ticket} title={`Ticket ${ticket.ref}`} onClose={onClose}>
      <div className="stack-lg">
        <div>
          <StatusChip status={ticket.status} />
          <h3 className="con-h3" style={{ marginTop: '0.75rem' }}>
            {ticket.subject}
          </h3>
        </div>
        <DetailList
          items={[
            ['Client', ticket.investorId ? <Link to={`/console/clients/${ticket.investorId}`}>{ticket.investorName}</Link> : ticket.investorName],
            ['Category', humanize(ticket.category)],
            ['Raised', formatDateTime(ticket.createdAt)],
            ['Updated', formatDateTime(ticket.updatedAt)],
          ]}
        />
        <section aria-labelledby="con-tk-desc">
          <h3 id="con-tk-desc" className="con-h3">
            Description
          </h3>
          <p className="small con-prewrap">{ticket.description || '—'}</p>
        </section>
        <section aria-labelledby="con-tk-thread">
          <h3 id="con-tk-thread" className="con-h3">
            Comments
          </h3>
          {ticket.comments?.length ? (
            <ol className="con-thread">
              {ticket.comments.map((cm, i) => (
                <li key={`${cm.at}-${i}`} className="con-thread__item">
                  <div className="row row--between tiny muted">
                    <strong className="con-thread__by">{cm.by}</strong>
                    <span>{formatDateTime(cm.at)}</span>
                  </div>
                  <p className="small con-prewrap">{cm.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="small muted">No comments yet.</p>
          )}
        </section>
        <form className="stack" onSubmit={submit} noValidate aria-label="Update ticket">
          {error && !errs.comment && <Alert type="error">{friendlyError(error)}</Alert>}
          <Field label="Status" error={errs.status}>
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={opts(TICKET_STATUSES)} />
          </Field>
          <Field label="Comment" error={errs.comment} hint="Visible to the client.">
            <Textarea rows={3} value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
          </Field>
          <div className="row row--end">
            <Button type="submit" loading={saving}>
              Update ticket
            </Button>
          </div>
        </form>
      </div>
    </Drawer>
  );
}
