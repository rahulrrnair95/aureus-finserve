import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi, publicApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useInvestor } from '../../layouts/InvestorLayout';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import OtpInput from '../../components/OtpInput';
import RiskOMeter from '../../components/RiskOMeter';
import StatusChip from '../../components/StatusChip';
import Tabs from '../../components/Tabs';
import Icon from '../../components/Icon';
import { Alert, Async, DevOtp, EmptyState } from '../../components/States';
import { Skeleton, SkeletonBlock } from '../../components/Skeleton';
import { StandardDisclaimer, useCountdown } from '../../components/Misc';
import { useToast } from '../../components/Toast';
import { formatDateTime, formatINR, formatUnits, humanize } from '../../utils/format';
import { InfoList, ORDER_STATUSES, PageTitle, orderTypeLabel } from './parts/common';

const LIVE = ['PLACED', 'PAYMENT_RECEIVED'];
const PAY = { UPI: 'UPI', NETBANKING: 'Net banking', MANDATE: 'Mandate (auto-debit)' };
const payLabel = (p) => PAY[p] || humanize(p);

export default function Orders() {
  useTitle('Orders');
  const [params, setParams] = useSearchParams();
  const raw = params.get('status') || '';
  const status = ORDER_STATUSES.includes(raw) ? raw : '';
  const { refreshUnread } = useInvestor();
  const toast = useToast();
  const q = useApi(() => investorApi.orders(status || undefined), [status]);
  const [approve, setApprove] = useState(null);
  const [reject, setReject] = useState(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectErr, setRejectErr] = useState('');

  const live = Array.isArray(q.data) && q.data.some((o) => LIVE.includes(o.status));
  const { reload } = q;
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(() => reload(), 15000);
    return () => clearInterval(t);
  }, [live, reload]);

  const replace = (o) => q.setData((list) => (list || []).map((x) => (x.id === o.id ? o : x)).filter((x) => !status || x.status === status || x.id === o.id));

  const setStatus = (s) => {
    const next = new URLSearchParams(params);
    if (s) next.set('status', s);
    else next.delete('status');
    setParams(next, { replace: true });
  };

  const doReject = async () => {
    setRejectBusy(true);
    setRejectErr('');
    try {
      const o = await investorApi.reject(reject.id);
      replace(o && o.id ? o : { ...reject, status: 'CANCELLED' });
      toast.success(`Order ${reject.ref} rejected.`);
      setReject(null);
      refreshUnread?.();
    } catch (e) {
      setRejectErr(friendlyError(e));
    } finally {
      setRejectBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Transactions" title="Orders">
        <Button size="sm" to="/app/transact">
          New order
        </Button>
      </PageTitle>
      <div>
        <Tabs
          label="Filter orders by status"
          value={status || 'ALL'}
          onChange={(id) => setStatus(id === 'ALL' ? '' : id)}
          tabs={[{ id: 'ALL', label: 'All' }, ...ORDER_STATUSES.map((s) => ({ id: s, label: s === 'PENDING_APPROVAL' ? 'Awaiting approval' : humanize(s) }))]}
        />
        {live && (
          <p className="tiny muted inv-live" role="status">
            <span className="inv-live__dot" aria-hidden="true" /> Some orders are in progress — this list refreshes automatically every 15 seconds.
          </p>
        )}
      </div>
      <Async
        state={q}
        skeleton={<SkeletonBlock rows={6} height={24} />}
        empty={(d) => !d?.length}
        emptyView={
          <div className="card">
            <EmptyState
              title={status ? `No ${status === 'PENDING_APPROVAL' ? 'orders awaiting approval' : `${humanize(status).toLowerCase()} orders`}` : 'No orders yet'}
              icon="list"
              action={
                status ? (
                  <Button variant="outline" size="sm" onClick={() => setStatus('')}>
                    Show all orders
                  </Button>
                ) : (
                  <Button to="/app/transact">Place your first order</Button>
                )
              }
            />
          </div>
        }
      >
        {(list) => (
          <ul className="inv-orders">
            {list.map((o) => (
              <OrderCard key={o.id} o={o} onApprove={() => setApprove(o)} onReject={() => (setRejectErr(''), setReject(o))} />
            ))}
          </ul>
        )}
      </Async>

      {approve && (
        <ApproveDialog
          order={approve}
          onClose={() => setApprove(null)}
          onDone={(o) => {
            replace(o);
            setApprove(null);
            toast.success(`Order ${o.ref || approve.ref} approved and placed.`);
            refreshUnread?.();
          }}
        />
      )}
      <ConfirmDialog
        open={!!reject}
        title="Reject proposed order"
        danger
        confirmLabel="Reject order"
        cancelLabel="Go back"
        loading={rejectBusy}
        error={rejectErr}
        onConfirm={doReject}
        onClose={() => !rejectBusy && setReject(null)}
      >
        {reject && (
          <p style={{ margin: 0 }}>
            Reject the {orderTypeLabel(reject.type).toLowerCase()} order <strong>{reject.ref}</strong> in {reject.schemeName} proposed by {reject.placedBy}? It will be cancelled and not sent to the exchange.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

function orderQty(o) {
  if (o.allUnits) return 'All units';
  if (o.amount !== null && o.amount !== undefined) return formatINR(o.amount);
  if (o.units !== null && o.units !== undefined) return `${formatUnits(o.units)} units`;
  return '—';
}

function OrderCard({ o, onApprove, onReject }) {
  const [open, setOpen] = useState(false);
  const histId = useId();
  const byRm = o.placedByRole && o.placedByRole !== 'INVESTOR';
  const pending = o.status === 'PENDING_APPROVAL';
  return (
    <li className={`card inv-order ${pending ? 'inv-order--pending' : ''}`}>
      <article aria-labelledby={`${histId}-t`}>
        <div className="inv-order__head">
          <div>
            <span className="eyebrow">
              {orderTypeLabel(o.type)} · <span className="num">{o.ref}</span>
            </span>
            <h2 id={`${histId}-t`} className="inv-order__scheme">
              {o.schemeName}
              {o.targetSchemeName && (
                <>
                  <span className="sr-only"> to </span>
                  <Icon name="chevronRight" size={16} className="inv-order__arrow" />
                  {o.targetSchemeName}
                </>
              )}
            </h2>
          </div>
          <StatusChip status={o.status} label={pending ? 'Awaiting your approval' : undefined} />
        </div>
        <InfoList
          items={[
            { label: o.type === 'REDEEM' || o.type === 'SWITCH' ? 'Amount / units' : 'Amount', value: <span className="num">{orderQty(o)}</span> },
            o.sipDay && { label: 'Date each month', value: o.sipDay },
            o.installments && { label: 'Instalments', value: o.installments },
            o.folioNo && { label: 'Folio', value: o.folioNo },
            o.paymentMode && { label: 'Payment', value: payLabel(o.paymentMode) },
            o.investorName && { label: 'Investor', value: o.investorName },
            {
              label: 'Placed by',
              value: (
                <>
                  {o.placedBy}
                  {byRm && (
                    <>
                      {' '}
                      <span className="chip chip--gold">Raised by your RM</span>
                    </>
                  )}
                </>
              ),
            },
            { label: 'Created', value: formatDateTime(o.createdAt) },
            o.exchangeRef && { label: 'Exchange ref', value: <span className="num">{o.exchangeRef}</span> },
          ]}
        />
        <div className="row row--between inv-order__foot">
          {o.history?.length ? (
            <button type="button" className="btn btn--link" aria-expanded={open} aria-controls={`${histId}-h`} onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide' : 'Show'} status history ({o.history.length})
            </button>
          ) : (
            <span />
          )}
          {pending && (
            <div className="row">
              <Button variant="ghost" size="sm" onClick={onReject}>
                Reject
              </Button>
              <Button size="sm" onClick={onApprove}>
                Review & approve
              </Button>
            </div>
          )}
        </div>
        {o.history?.length > 0 && (
          <ol id={`${histId}-h`} className="timeline inv-order__history" hidden={!open}>
            {o.history.map((h, i) => (
              <li key={`${h.status}-${h.at}-${i}`}>
                <strong>{humanize(h.status)}</strong> <span className="tiny muted">{formatDateTime(h.at)}</span>
                {h.note && <div className="small muted">{h.note}</div>}
              </li>
            ))}
          </ol>
        )}
      </article>
    </li>
  );
}

function ApproveDialog({ order, onClose, onDone }) {
  const [challenge, setChallenge] = useState(null);
  const [sendErr, setSendErr] = useState('');
  const [sending, setSending] = useState(true);
  const [sentCount, setSentCount] = useState(0);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = useCountdown(30, [sentCount]);

  const scheme = useApi(() => publicApi.scheme(order.schemeId), [order.schemeId]);
  const target = useApi(() => (order.targetSchemeId ? publicApi.scheme(order.targetSchemeId) : Promise.resolve(null)), [order.targetSchemeId]);

  const send = async () => {
    setSending(true);
    setSendErr('');
    try {
      const res = await investorApi.approveOtp(order.id);
      setChallenge(res);
      setOtp('');
      setSentCount((n) => n + 1);
    } catch (e) {
      setSendErr(friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const requested = useRef(null);
  useEffect(() => {
    if (requested.current === order.id) return; // avoid a duplicate OTP under StrictMode
    requested.current = order.id;
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const submit = async (code = otp) => {
    if (!challenge?.challengeId) return;
    if (code.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const o = await investorApi.approve(order.id, { challengeId: challenge.challengeId, otp: code });
      onDone(o && o.id ? o : { ...order, status: 'PLACED' });
    } catch (e) {
      setError(friendlyError(e));
      if (e.code === 'OTP_ATTEMPTS_EXCEEDED' || e.code === 'OTP_EXPIRED') setOtp('');
    } finally {
      setBusy(false);
    }
  };

  const riskFor = (state, name) =>
    state.loading && !state.data ? (
      <Skeleton width={200} height={120} />
    ) : state.data ? (
      <RiskOMeter risk={state.data.risk} sidUrl={state.data.sidUrl} schemeName={state.data.name || name} size={200} />
    ) : (
      <p className="small muted">Risk details for {name} are unavailable right now. Please read the Scheme Information Document before approving.</p>
    );

  return (
    <Modal
      open
      wide
      title="Approve proposed order"
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => submit()} loading={busy} disabled={!challenge?.challengeId || otp.length !== 6}>
            Approve order
          </Button>
        </>
      }
    >
      <div className="stack-lg">
        <div className="stack">
          <p style={{ margin: 0 }}>
            Your relationship manager <strong>{order.placedBy}</strong> has proposed this order. It will be placed on the exchange only after you approve it with the OTP sent to your registered mobile and email.
          </p>
          <InfoList
            items={[
              { label: 'Order ref', value: <span className="num">{order.ref}</span> },
              { label: 'Type', value: orderTypeLabel(order.type) },
              { label: 'Scheme', value: order.schemeName },
              order.targetSchemeName && { label: 'Target scheme', value: order.targetSchemeName },
              { label: 'Amount / units', value: <span className="num">{orderQty(order)}</span> },
              order.sipDay && { label: 'Date each month', value: order.sipDay },
              order.installments && { label: 'Instalments', value: order.installments },
              order.folioNo && { label: 'Folio', value: order.folioNo },
              order.paymentMode && { label: 'Payment mode', value: payLabel(order.paymentMode) },
            ]}
          />
        </div>
        <div className="inv-risk-row">
          <div>{riskFor(scheme, order.schemeName)}</div>
          {order.targetSchemeId && <div>{riskFor(target, order.targetSchemeName)}</div>}
        </div>
        <StandardDisclaimer compact />
        <div className="stack">
          {sending && !challenge ? (
            <SkeletonBlock rows={2} />
          ) : sendErr && !challenge ? (
            <Alert
              type="error"
              action={
                <Button variant="outline" size="sm" onClick={send} loading={sending}>
                  Try again
                </Button>
              }
            >
              {sendErr}
            </Alert>
          ) : (
            <>
              <p className="small" style={{ margin: 0 }}>
                We have sent a 6-digit OTP to your registered mobile number and email.
              </p>
              <OtpInput value={otp} onChange={setOtp} label="Enter the OTP to approve" onComplete={(v) => submit(v)} invalid={!!error} />
              <DevOtp code={challenge?.devOtp} />
              <div className="row small">
                {left > 0 ? (
                  <span className="muted" aria-live="polite">
                    Resend OTP in {left}s
                  </span>
                ) : (
                  <Button variant="link" size="sm" onClick={send} loading={sending}>
                    Resend OTP
                  </Button>
                )}
              </div>
              {sendErr && <Alert type="error">{sendErr}</Alert>}
            </>
          )}
          {error && <Alert type="error">{error}</Alert>}
          <p className="tiny muted" style={{ margin: 0 }}>
            Not expecting this order? <Link to="/app/rm">Contact your RM</Link> or reject it from the orders list.
          </p>
        </div>
      </div>
    </Modal>
  );
}
