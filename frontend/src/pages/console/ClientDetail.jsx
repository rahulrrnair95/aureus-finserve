import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { useAuth } from '../../auth/AuthContext';
import { formatDate, formatDateTime, formatINR, formatNav, formatUnits, humanize } from '../../utils/format';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import Tabs from '../../components/Tabs';
import Money, { Pct } from '../../components/Money';
import { EmptyState, ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import { CopyField, DetailList, PageTitle } from './parts/ui';
import ClientFormModal from './parts/ClientFormModal';

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const toast = useToast();
  const q = useApi(() => adminApi.client(id), [id]);
  const c = q.data;
  useTitle(c ? c.name : 'Client');

  const [tab, setTab] = useState('holdings');
  const [link, setLink] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusErr, setStatusErr] = useState(null);
  const [editing, setEditing] = useState(false);

  if (q.error && !c) return <ErrorState error={q.error} onRetry={q.reload} title={q.error.code === 'NOT_FOUND' ? 'Client not found' : undefined} />;
  if (!c) return <SkeletonBlock rows={8} height={24} />;

  const disabled = c.loginStatus === 'DISABLED';

  const regenerate = async () => {
    setLinkLoading(true);
    try {
      const res = await adminApi.activationLink(c.id);
      setLink(res.activationLink);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLinkLoading(false);
    }
  };

  const toggleStatus = async () => {
    setStatusBusy(true);
    setStatusErr(null);
    try {
      const res = await adminApi.clientStatus(c.id, disabled);
      q.setData((d) => ({ ...d, ...res }));
      toast.success(disabled ? 'Client enabled.' : 'Client disabled.');
      setStatusOpen(false);
    } catch (err) {
      setStatusErr(friendlyError(err));
    } finally {
      setStatusBusy(false);
    }
  };

  const holdings = c.holdings || [];
  const sips = c.sips || [];
  const orders = c.orders || [];

  return (
    <div className="stack-lg">
      <nav aria-label="Breadcrumb" className="small">
        <Link to="/console/clients">← All clients</Link>
      </nav>
      <PageTitle eyebrow="Client" title={c.name}>
        <Button to={`/console/orders?client=${c.id}&new=1`}>
          <Icon name="cart" size={18} /> New order for this client
        </Button>
      </PageTitle>

      <div className="row con-chips">
        <StatusChip status={c.kycStatus} label={`KYC: ${humanize(c.kycStatus)}`} />
        <StatusChip status={c.loginStatus} label={`Login: ${humanize(c.loginStatus)}`} />
        <span className="small muted">RM: {c.rmName || 'Unassigned'}</span>
      </div>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="con-cd-details">
          <div className="card__head">
            <h2 id="con-cd-details" className="card__title">
              Details
            </h2>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Icon name="edit" size={16} /> Edit
              </Button>
            )}
          </div>
          <DetailList
            items={[
              ['PAN', <span className="num">{c.panMasked}</span>],
              ['Date of birth', formatDate(c.dob)],
              ['Email', c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null],
              ['Mobile', <span className="num">{c.mobileMasked}</span>],
              ['Address', c.address],
              ['AUM', <Money value={c.aum} decimals={0} />],
              ['Client since', formatDate(c.createdAt)],
            ]}
          />
        </section>

        <div className="stack-lg">
          <section className="card" aria-labelledby="con-cd-family">
            <div className="card__head">
              <h2 id="con-cd-family" className="card__title">
                Family
              </h2>
            </div>
            {c.family?.length ? (
              <ul className="con-list">
                {c.family.map((m) => (
                  <li key={m.id}>
                    {String(m.id) === String(c.id) ? <strong>{m.name}</strong> : <Link to={`/console/clients/${m.id}`}>{m.name}</Link>}
                    <span className="muted small"> · {humanize(m.relation)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">No linked family members.</p>
            )}
          </section>

          <section className="card" aria-labelledby="con-cd-access">
            <div className="card__head">
              <h2 id="con-cd-access" className="card__title">
                Online access
              </h2>
            </div>
            <div className="stack">
              <p className="small muted">
                {c.loginStatus === 'NOT_ACTIVATED'
                  ? 'The client has not activated online access yet.'
                  : c.loginStatus === 'LOCKED'
                    ? 'The account is locked after failed login attempts. Enabling it again unlocks it.'
                    : 'Generate a fresh activation link if the client needs to set up access again.'}
              </p>
              <div className="row">
                <Button variant="outline" size="sm" onClick={regenerate} loading={linkLoading}>
                  Regenerate activation link
                </Button>
                {isAdmin && (
                  <Button variant={disabled ? 'primary' : 'danger'} size="sm" onClick={() => setStatusOpen(true)}>
                    {disabled ? 'Enable login' : 'Disable login'}
                  </Button>
                )}
              </div>
              {link && <CopyField label="Activation link" value={link} hint="Valid for 7 days. It has also been sent to the client by SMS and email." />}
            </div>
          </section>
        </div>
      </div>

      <section aria-labelledby="con-cd-portfolio" className="stack">
        <h2 id="con-cd-portfolio" className="sr-only">
          Portfolio
        </h2>
        <Tabs
          label="Client portfolio"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'holdings', label: 'Holdings', badge: holdings.length || null },
            { id: 'sips', label: 'SIPs', badge: sips.length || null },
            { id: 'orders', label: 'Orders', badge: orders.length || null },
          ]}
        />
        <div role="tabpanel" aria-label={humanize(tab)}>
          {tab === 'holdings' &&
            (holdings.length ? (
              <DataTable
                caption="Holdings"
                rowKey="folioId"
                rows={holdings}
                columns={[
                  { key: 'schemeName', header: 'Scheme', primary: true, render: (r) => <span>{r.schemeName}<br /><span className="tiny muted">{r.amc}</span></span> },
                  { key: 'folioNo', header: 'Folio' },
                  { key: 'units', header: 'Units', num: true, render: (r) => formatUnits(r.units) },
                  { key: 'nav', header: 'NAV', num: true, render: (r) => formatNav(r.nav) },
                  { key: 'invested', header: 'Invested', num: true, render: (r) => formatINR(r.invested) },
                  { key: 'value', header: 'Value', num: true, render: (r) => formatINR(r.value) },
                  { key: 'gain', header: 'Gain', num: true, render: (r) => <><Money value={r.gain} colored signed /> <Pct value={r.gainPct} /></> },
                ]}
              />
            ) : (
              <EmptyState title="No holdings" icon="layers" />
            ))}
          {tab === 'sips' &&
            (sips.length ? (
              <DataTable
                caption="SIPs"
                rows={sips}
                columns={[
                  { key: 'schemeName', header: 'Scheme', primary: true },
                  { key: 'amount', header: 'Amount', num: true, render: (r) => formatINR(r.amount, { decimals: 0 }) },
                  { key: 'sipDay', header: 'SIP day', num: true },
                  { key: 'nextDebitDate', header: 'Next debit', render: (r) => formatDate(r.nextDebitDate) },
                  { key: 'installmentsDone', header: 'Instalments', num: true },
                  { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
                ]}
              />
            ) : (
              <EmptyState title="No SIPs" icon="repeat" />
            ))}
          {tab === 'orders' &&
            (orders.length ? (
              <DataTable
                caption="Orders"
                rows={orders}
                columns={[
                  { key: 'ref', header: 'Ref', primary: true, render: (r) => <span className="num">{r.ref}</span> },
                  { key: 'type', header: 'Type', render: (r) => humanize(r.type) },
                  { key: 'schemeName', header: 'Scheme', render: (r) => <>{r.schemeName}{r.targetSchemeName && <span className="muted"> → {r.targetSchemeName}</span>}</> },
                  { key: 'amount', header: 'Amount / units', num: true, render: (r) => (r.allUnits ? 'All units' : r.amount != null ? formatINR(r.amount) : `${formatUnits(r.units)} u`) },
                  { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
                  { key: 'createdAt', header: 'Placed', render: (r) => formatDateTime(r.createdAt) },
                ]}
              />
            ) : (
              <EmptyState title="No orders" icon="cart" action={<Button variant="outline" to={`/console/orders?client=${c.id}&new=1`}>Place an order</Button>} />
            ))}
        </div>
      </section>

      <ConfirmDialog
        open={statusOpen}
        title={disabled ? 'Enable this client?' : 'Disable this client?'}
        confirmLabel={disabled ? 'Enable' : 'Disable'}
        danger={!disabled}
        loading={statusBusy}
        error={statusErr}
        onConfirm={toggleStatus}
        onClose={() => {
          setStatusOpen(false);
          setStatusErr(null);
        }}
      >
        <p>
          {disabled
            ? `${c.name} will be able to log in again. A locked account is also unlocked.`
            : `${c.name} will not be able to log in until the account is enabled again. Existing SIPs are not affected.`}
        </p>
      </ConfirmDialog>

      {isAdmin && <ClientFormModal open={editing} onClose={() => setEditing(false)} isAdmin client={c} onSaved={(saved) => { q.setData((d) => ({ ...d, ...saved })); toast.success('Client updated.'); }} />}
    </div>
  );
}
