import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { useAuth } from '../../auth/AuthContext';
import { formatDateTime, formatINR, formatUnits, humanize } from '../../utils/format';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import { Drawer } from '../../components/Modal';
import { Field, Input, Select, Textarea } from '../../components/Field';
import { Alert, Async, EmptyState, ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import CartBuilder from '../../components/order/CartBuilder';
import { ORDER_STATUSES, fieldErrors, opts, useInterval } from './parts/common';
import { DetailList, PageTitle } from './parts/ui';

const amountText = (r) => (r.allUnits ? 'All units' : r.amount != null ? formatINR(r.amount) : r.units != null ? `${formatUnits(r.units)} units` : '—');

export default function OrderDesk() {
  useTitle('Order desk');
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const clientParam = params.get('client') || '';
  const isNew = params.get('new') === '1';
  const [selected, setSelected] = useState(null);

  const clients = useApi(() => adminApi.clients({}), []);
  const list = useApi(() => adminApi.orders({ status, clientId: clientParam }), [status, clientParam]);
  useInterval(() => list.reload(), 20000);

  const setParam = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const clientOptions = (clients.data || []).map((c) => ({ value: String(c.id), label: c.name }));

  const columns = [
    { key: 'ref', header: 'Ref', primary: true, render: (r) => <span className="num">{r.ref}</span> },
    { key: 'investorName', header: 'Client' },
    { key: 'type', header: 'Type', render: (r) => humanize(r.type) },
    {
      key: 'schemeName',
      header: 'Scheme',
      render: (r) => (
        <span>
          {r.schemeName}
          {r.targetSchemeName && <span className="muted"> → {r.targetSchemeName}</span>}
        </span>
      ),
    },
    { key: 'amount', header: 'Amount / units', num: true, render: amountText },
    { key: 'paymentMode', header: 'Payment', render: (r) => (r.paymentMode ? humanize(r.paymentMode) : '—') },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
    { key: 'placedBy', header: 'Placed by', render: (r) => <span>{r.placedBy}{r.placedByRole && <span className="tiny muted"> ({humanize(r.placedByRole)})</span>}</span> },
    { key: 'createdAt', header: 'Created', render: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <div className="stack-lg">
      <PageTitle title="Order desk">
        {!isNew && (
          <Button onClick={() => setParam({ new: '1' })}>
            <Icon name="plus" size={18} /> New order for client
          </Button>
        )}
      </PageTitle>

      {isNew && (
        <NewOrderPanel
          clientId={clientParam}
          clientOptions={clientOptions}
          clientsLoading={clients.loading}
          onClientChange={(id) => setParam({ client: id })}
          onClose={() => setParam({ new: '' })}
          onPlaced={() => list.reload()}
        />
      )}

      <section className="stack" aria-labelledby="con-orders-h">
        <h2 id="con-orders-h" className={isNew ? undefined : 'sr-only'}>
          Orders
        </h2>
        <div className="card con-filters" role="search" aria-label="Filter orders">
          <Field label="Status">
            <Select value={status} onChange={(e) => setParam({ status: e.target.value })} placeholder="All statuses" options={opts(ORDER_STATUSES)} />
          </Field>
          <Field label="Client">
            <Select value={clientParam} onChange={(e) => setParam({ client: e.target.value })} placeholder="All clients" options={clientOptions} />
          </Field>
          <p className="tiny muted con-filters__note">Refreshes automatically every 20 seconds.</p>
        </div>

        <Async state={list} skeleton={<SkeletonBlock rows={6} height={28} />} empty={(d) => !d.length} emptyView={<EmptyState title={status || clientParam ? 'No orders match your filters' : 'No orders yet'} icon="cart" />}>
          {(rows) => (
            <>
              {list.error && <Alert type="warning">Could not refresh: {friendlyError(list.error)}</Alert>}
              <DataTable caption="Orders" columns={columns} rows={rows} onRowClick={setSelected} rowLabel={(r) => `Order ${r.ref} details`} highlight={(r) => r.status === 'PENDING_APPROVAL'} />
            </>
          )}
        </Async>
      </section>

      <OrderDrawer
        order={selected}
        isAdmin={isAdmin}
        onClose={() => setSelected(null)}
        onUpdated={(o) => {
          setSelected(o);
          list.setData((rows) => (rows || []).map((r) => (r.id === o.id ? o : r)));
          toast.success(`Order ${o.ref} updated to ${humanize(o.status)}.`);
        }}
      />
    </div>
  );
}

function NewOrderPanel({ clientId, clientOptions, clientsLoading, onClientChange, onClose, onPlaced }) {
  const [search, setSearch] = useState('');
  const client = useApi(() => adminApi.client(clientId), [clientId], { enabled: !!clientId });
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = s ? clientOptions.filter((o) => o.label.toLowerCase().includes(s)) : clientOptions;
    // keep the selected client visible even when filtered out
    if (clientId && !list.some((o) => o.value === clientId)) {
      const sel = clientOptions.find((o) => o.value === clientId);
      if (sel) return [sel, ...list];
    }
    return list;
  }, [search, clientOptions, clientId]);

  const c = clientId ? client.data : null;

  return (
    <section className="card con-neworder stack-lg" aria-labelledby="con-neworder-h">
      <div className="card__head">
        <h2 id="con-neworder-h" className="card__title">
          New order for a client
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <Alert type="info" title="Client approval required">
        Orders you place are created as PENDING_APPROVAL. The client must approve each order with an OTP from their Orders page before it is sent to the exchange.
      </Alert>
      <div className="form-grid form-grid--2">
        <Field label="Find client" hint="Type to filter the list">
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client name" />
        </Field>
        <Field label="Client" required>
          <Select value={clientId} onChange={(e) => onClientChange(e.target.value)} placeholder={clientsLoading ? 'Loading clients…' : `Select a client (${filtered.length})`} options={filtered} />
        </Field>
      </div>

      {!clientId ? (
        <p className="small muted">Select a client to start building the order.</p>
      ) : client.error && !c ? (
        <ErrorState error={client.error} onRetry={client.reload} />
      ) : !c || String(c.id) !== String(clientId) ? (
        <SkeletonBlock rows={5} height={24} />
      ) : (
        <div className="stack">
          <div className="row con-chips">
            <strong>
              <Link to={`/console/clients/${c.id}`}>{c.name}</Link>
            </strong>
            <span className="num small muted">{c.panMasked}</span>
            <StatusChip status={c.kycStatus} label={`KYC: ${humanize(c.kycStatus)}`} />
          </div>
          {c.kycStatus !== 'VALIDATED' && (
            <Alert type="warning" title="KYC not validated">
              Orders cannot be placed until this client’s KYC is validated.
            </Alert>
          )}
          <CartBuilder
            key={c.id}
            mode="staff"
            investorId={c.id}
            holdings={c.holdings || []}
            onSubmit={async (cart) => {
              const res = await adminApi.placeOrders(cart);
              onPlaced?.(res);
              return res;
            }}
          />
        </div>
      )}
    </section>
  );
}

function OrderDrawer({ order, isAdmin, onClose, onUpdated }) {
  const [form, setForm] = useState({ status: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (order) {
      setForm({ status: order.status, note: '' });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  if (!order) return null;
  const errs = fieldErrors(error);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.note.trim()) {
      setError({ fields: { note: 'Add a note explaining the override.' }, error: 'Add a note explaining the override.' });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const o = await adminApi.orderStatus(order.id, { status: form.status, note: form.note.trim() });
      onUpdated(o);
      setForm((f) => ({ ...f, note: '' }));
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const history = [...(order.history || [])];

  return (
    <Drawer open={!!order} title={`Order ${order.ref}`} onClose={onClose}>
      <div className="stack-lg">
        <div className="row">
          <StatusChip status={order.status} />
          <span className="small muted">{humanize(order.type)}</span>
        </div>
        <DetailList
          items={[
            ['Client', <Link to={`/console/clients/${order.investorId}`}>{order.investorName}</Link>],
            ['Scheme', order.schemeName],
            ['Target scheme', order.targetSchemeName],
            ['Folio', order.folioNo],
            ['Amount / units', amountText(order)],
            ['SIP / instalment day', order.sipDay],
            ['Instalments', order.installments],
            ['Payment mode', order.paymentMode ? humanize(order.paymentMode) : null],
            ['Placed by', `${order.placedBy || '—'}${order.placedByRole ? ` (${humanize(order.placedByRole)})` : ''}`],
            ['Exchange ref', order.exchangeRef],
            ['Created', formatDateTime(order.createdAt)],
          ]}
        />
        <section aria-labelledby="con-hist-h">
          <h3 id="con-hist-h" className="con-h3">
            History
          </h3>
          {history.length ? (
            <ol className="timeline">
              {history.map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <div className="row">
                    <StatusChip status={h.status} />
                    <span className="tiny muted">{formatDateTime(h.at)}</span>
                  </div>
                  {h.note && <div className="small">{h.note}</div>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="small muted">No history yet.</p>
          )}
        </section>

        {isAdmin && (
          <section aria-labelledby="con-override-h" className="con-override">
            <h3 id="con-override-h" className="con-h3">
              Override status
            </h3>
            <p className="tiny muted">For manual exchange reconciliation. The change and note are recorded in the audit log and the client is notified.</p>
            <form className="stack" onSubmit={submit} noValidate>
              {error && !errs.note && <Alert type="error">{friendlyError(error)}</Alert>}
              <Field label="New status" error={errs.status}>
                <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={opts(ORDER_STATUSES)} />
              </Field>
              <Field label="Note" required error={errs.note}>
                <Textarea rows={3} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </Field>
              <div className="row row--end">
                <Button type="submit" variant="danger" loading={saving} disabled={form.status === order.status && !form.note}>
                  Apply override
                </Button>
              </div>
            </form>
          </section>
        )}
      </div>
    </Drawer>
  );
}
