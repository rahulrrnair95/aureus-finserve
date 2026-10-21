import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Tabs from '../Tabs';
import Button from '../Button';
import Icon from '../Icon';
import { Drawer } from '../Modal';
import { Field, Select, MoneyInput, Input, Checkbox } from '../Field';
import { Alert } from '../States';
import { StandardDisclaimer } from '../Misc';
import RiskOMeter, { RiskBadge } from '../RiskOMeter';
import StatusChip from '../StatusChip';
import SchemePicker from './SchemePicker';
import { publicApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { formatINR, formatUnits, formatNav, humanize } from '../../utils/format';

const TYPES = [
  { id: 'LUMPSUM', label: 'Buy' },
  { id: 'SIP', label: 'SIP' },
  { id: 'REDEEM', label: 'Redeem' },
  { id: 'SWITCH', label: 'Switch' },
  { id: 'STP', label: 'STP' },
  { id: 'SWP', label: 'SWP' },
];
const TYPE_LABEL = { LUMPSUM: 'Lump sum purchase', SIP: 'SIP', REDEEM: 'Redemption', SWITCH: 'Switch', STP: 'Systematic transfer (STP)', SWP: 'Systematic withdrawal (SWP)' };
const TYPE_HELP = {
  LUMPSUM: 'Invest a one-time amount in a scheme.',
  SIP: 'Invest a fixed amount every month on a date of your choice. SIPs are debited through an eNACH mandate.',
  REDEEM: 'Withdraw money from an existing folio, by amount, units or all units.',
  SWITCH: 'Move money from one scheme to another scheme of the same AMC.',
  STP: 'Transfer a fixed amount every month from one scheme to another scheme of the same AMC.',
  SWP: 'Withdraw a fixed amount every month from an existing folio.',
};
const PAYMENT_MODES = [
  { value: 'UPI', label: 'UPI' },
  { value: 'NETBANKING', label: 'Net banking' },
  { value: 'MANDATE', label: 'eNACH mandate' },
];
const FOLIO_TYPES = ['REDEEM', 'SWITCH', 'STP', 'SWP'];
const RECURRING = ['SIP', 'STP', 'SWP'];
const DAYS = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

const emptyForm = () => ({ scheme: null, folioId: '', target: null, amount: '', units: '', by: 'amount', sipDay: '5', installments: '60' });

/**
 * Shared order builder for investor Transact and staff Order desk.
 * Props: { investorId, holdings, preselect?: { schemeId?, type?, folioId? }, mode: 'investor'|'staff', onSubmit: async (cartRequest) => Order[] }
 */
export default function CartBuilder({ investorId, holdings = [], preselect, mode = 'investor', onSubmit }) {
  const staff = mode === 'staff';
  const myHoldings = useMemo(() => holdings.filter((h) => h.investorId == null || investorId == null || String(h.investorId) === String(investorId)), [holdings, investorId]);
  const [type, setType] = useState(preselect?.type && TYPES.some((t) => t.id === preselect.type) ? preselect.type : 'LUMPSUM');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [stage, setStage] = useState('build'); // build | review | done
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [orders, setOrders] = useState(null);
  const [details, setDetails] = useState({}); // schemeId -> scheme detail (for sidUrl/risk)
  const [preErr, setPreErr] = useState(null);

  // Preselect scheme / folio
  useEffect(() => {
    if (preselect?.schemeId) {
      publicApi
        .scheme(preselect.schemeId)
        .then((s) => {
          setDetails((d) => ({ ...d, [s.id]: s }));
          setForm((f) => ({ ...f, scheme: s }));
        })
        .catch((e) => setPreErr(friendlyError(e)));
    }
    if (preselect?.folioId) setForm((f) => ({ ...f, folioId: String(preselect.folioId) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect?.schemeId, preselect?.folioId]);

  // Default payment mode: mandate when there are recurring items
  useEffect(() => {
    if (paymentTouched) return;
    setPaymentMode(cart.some((i) => RECURRING.includes(i.type)) ? 'MANDATE' : 'UPI');
  }, [cart, paymentTouched]);

  const holding = myHoldings.find((h) => String(h.folioId) === String(form.folioId));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  const ensureDetail = (schemeId) => {
    if (!schemeId || details[schemeId]) return;
    publicApi
      .scheme(schemeId)
      .then((s) => setDetails((d) => ({ ...d, [s.id]: s })))
      .catch(() => {});
  };

  const changeType = (t) => {
    setType(t);
    setErrors({});
    setForm((f) => ({ ...emptyForm(), scheme: ['LUMPSUM', 'SIP'].includes(t) ? f.scheme : null, folioId: FOLIO_TYPES.includes(t) ? f.folioId : '' }));
  };

  const validate = () => {
    const e = {};
    const amt = Number(form.amount);
    if (['LUMPSUM', 'SIP'].includes(type)) {
      if (!form.scheme) e.scheme = 'Please select a scheme.';
      const min = type === 'SIP' ? form.scheme?.minSip : form.scheme?.minLumpsum;
      if (!form.amount || amt <= 0) e.amount = 'Enter an amount.';
      else if (min && amt < min) e.amount = `Minimum ${type === 'SIP' ? 'SIP instalment' : 'investment'} for this scheme is ${formatINR(min, { decimals: 0 })}.`;
    }
    if (FOLIO_TYPES.includes(type)) {
      if (!holding) e.folioId = 'Please select a folio.';
      if (['SWITCH', 'STP'].includes(type) && !form.target) e.target = 'Please select the target scheme.';
      if (['REDEEM', 'SWITCH'].includes(type)) {
        if (form.by === 'amount') {
          if (!form.amount || amt <= 0) e.amount = 'Enter an amount.';
          else if (holding && amt > Number(holding.value)) e.amount = `Amount cannot exceed the current value of ${formatINR(holding.value)}.`;
        } else if (form.by === 'units') {
          const u = Number(form.units);
          if (!form.units || u <= 0) e.units = 'Enter the number of units.';
          else if (holding && u > Number(holding.units)) e.units = `You hold ${formatUnits(holding.units)} units.`;
        }
      }
      if (['STP', 'SWP'].includes(type)) {
        if (!form.amount || amt <= 0) e.amount = 'Enter the monthly amount.';
        else if (holding && amt > Number(holding.value)) e.amount = `Amount cannot exceed the current value of ${formatINR(holding.value)}.`;
        if (type === 'STP' && form.target?.minSip && amt < form.target.minSip) e.amount = `Minimum STP instalment into the target scheme is ${formatINR(form.target.minSip, { decimals: 0 })}.`;
      }
    }
    if (RECURRING.includes(type)) {
      const n = Number(form.installments);
      if (!Number.isInteger(n) || n < 1 || n > 600) e.installments = 'Enter the number of instalments (1–600).';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addToCart = () => {
    if (!validate()) return;
    const item = { key: `${Date.now()}-${Math.random()}`, type };
    if (['LUMPSUM', 'SIP'].includes(type)) {
      item.schemeId = form.scheme.id;
      item.scheme = form.scheme;
      item.amount = Number(form.amount);
      setDetails((d) => ({ ...d, [form.scheme.id]: d[form.scheme.id] || form.scheme }));
    } else {
      item.folioId = holding.folioId;
      item.holding = holding;
      ensureDetail(holding.schemeId);
      if (form.target) {
        item.targetSchemeId = form.target.id;
        item.target = form.target;
        setDetails((d) => ({ ...d, [form.target.id]: d[form.target.id] || form.target }));
      }
      if (['REDEEM', 'SWITCH'].includes(type)) {
        if (form.by === 'all') item.allUnits = true;
        else if (form.by === 'units') item.units = Number(form.units);
        else item.amount = Number(form.amount);
      } else item.amount = Number(form.amount);
    }
    if (RECURRING.includes(type)) {
      item.sipDay = Number(form.sipDay);
      item.installments = Number(form.installments);
    }
    setCart((c) => [...c, item]);
    setForm((f) => ({ ...emptyForm(), folioId: f.folioId && FOLIO_TYPES.includes(type) ? '' : '' }));
    setErrors({});
    setCartOpen(true);
  };

  const removeItem = (key) => setCart((c) => c.filter((i) => i.key !== key));

  const buildRequest = () => ({
    investorId: Number(investorId),
    paymentMode,
    riskAcknowledged: ack,
    items: cart.map((i) => {
      const o = { type: i.type };
      ['schemeId', 'folioId', 'targetSchemeId', 'amount', 'units', 'allUnits', 'sipDay', 'installments'].forEach((k) => {
        if (i[k] !== undefined && i[k] !== null) o[k] = i[k];
      });
      return o;
    }),
  });

  const submit = async () => {
    if (!ack) {
      setSubmitError('Please confirm that you have read the scheme documents and understand the risk.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await onSubmit(buildRequest());
      setOrders(Array.isArray(res) ? res : res ? [res] : []);
      setStage('done');
      setCart([]);
      window.scrollTo(0, 0);
    } catch (err) {
      let msg = friendlyError(err);
      if (err.fields) msg += ` ${Object.values(err.fields).join(' ')}`;
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => {
    setOrders(null);
    setStage('build');
    setAck(false);
    setSubmitError(null);
    setPaymentTouched(false);
  };

  // ---------- Render helpers ----------
  const itemTitle = (i) => i.scheme?.name || i.holding?.schemeName || '—';
  const itemSummary = (i) => {
    const parts = [];
    if (i.allUnits) parts.push('All units');
    else if (i.units) parts.push(`${formatUnits(i.units)} units`);
    else if (i.amount) parts.push(`${formatINR(i.amount, { decimals: 0 })}${RECURRING.includes(i.type) ? ' / month' : ''}`);
    if (RECURRING.includes(i.type)) parts.push(`on day ${i.sipDay}, ${i.installments} instalments`);
    if (i.holding) parts.push(`Folio ${i.holding.folioNo}`);
    return parts.join(' · ');
  };
  const riskSchemes = (i) => {
    const list = [];
    const src = i.scheme || (i.holding && (details[i.holding.schemeId] || { id: i.holding.schemeId, name: i.holding.schemeName, risk: i.holding.risk }));
    if (src) list.push(details[src.id] || src);
    if (i.target) list.push(details[i.target.id] || i.target);
    return list;
  };

  const cartList = (
    <ul className="cart-list">
      {cart.map((i) => (
        <li key={i.key} className="cart-item">
          <div style={{ minWidth: 0 }}>
            <span className="chip chip--gold">{TYPE_LABEL[i.type]}</span>
            <div className="cart-item__name">{itemTitle(i)}</div>
            {i.target && <div className="small">→ {i.target.name}</div>}
            <div className="small muted">{itemSummary(i)}</div>
          </div>
          {stage === 'build' && (
            <button type="button" className="icon-btn" onClick={() => removeItem(i.key)} aria-label={`Remove ${TYPE_LABEL[i.type]} of ${itemTitle(i)} from cart`}>
              <Icon name="trash" size={18} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  // ---------- Done ----------
  if (stage === 'done') {
    return (
      <div className="stack-lg">
        <Alert type="success" title={staff ? 'Orders created — awaiting client approval' : 'Your order has been placed'}>
          {staff
            ? 'These orders are PENDING_APPROVAL. The client has been notified and must approve each order with an OTP from their Orders page before it is sent to the exchange.'
            : 'You will receive updates as your orders progress. Allotment is at the applicable NAV as per the scheme’s cut-off time rules.'}
        </Alert>
        <div className="card">
          <h2 className="card__title">Order references</h2>
          <ul className="cart-list">
            {orders.map((o) => (
              <li key={o.id || o.ref} className="cart-item">
                <div style={{ minWidth: 0 }}>
                  <div className="row">
                    <strong className="num">{o.ref}</strong>
                    <StatusChip status={o.status} />
                  </div>
                  <div className="cart-item__name">
                    {o.schemeName}
                    {o.targetSchemeName ? ` → ${o.targetSchemeName}` : ''}
                  </div>
                  <div className="small muted">
                    {humanize(o.type)}
                    {o.amount != null && ` · ${formatINR(o.amount)}`}
                    {o.units != null && ` · ${formatUnits(o.units)} units`}
                    {o.allUnits && ' · All units'}
                    {o.paymentMode && ` · ${humanize(o.paymentMode)}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-3">
          {orders
            .map((o) => details[o.schemeId])
            .filter((s, idx, arr) => s && arr.findIndex((x) => x && x.id === s.id) === idx)
            .map((s) => (
              <div className="card center" key={s.id}>
                <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>{s.name}</div>
                <RiskOMeter risk={s.risk} sidUrl={s.sidUrl} schemeName={s.name} size={200} />
              </div>
            ))}
        </div>
        <StandardDisclaimer />
        <div className="row">
          <Button onClick={startOver}>Place another order</Button>
          <Button variant="outline" to={staff ? '/console/orders' : '/app/orders'}>
            View orders
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Review ----------
  if (stage === 'review') {
    const needsMandate = cart.some((i) => RECURRING.includes(i.type));
    return (
      <div className="stack-lg">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Review your order</h2>
            <span className="small muted">
              {cart.length} item{cart.length === 1 ? '' : 's'}
            </span>
          </div>
          <ul className="order-confirm-list">
            {cart.map((i) => (
              <li key={i.key} className="order-confirm-item">
                <div className="order-confirm-item__info">
                  <span className="chip chip--gold">{TYPE_LABEL[i.type]}</span>
                  <h3 className="order-confirm-item__name">{itemTitle(i)}</h3>
                  {i.target && <p className="small" style={{ margin: 0 }}>Switching / transferring to: <strong>{i.target.name}</strong></p>}
                  <p className="small muted" style={{ margin: '0.25rem 0 0' }}>{itemSummary(i)}</p>
                </div>
                <div className="order-confirm-item__risk">
                  {riskSchemes(i).map((s) => (
                    <div key={s.id} className="center">
                      {riskSchemes(i).length > 1 && <div className="tiny muted" style={{ marginBottom: 4 }}>{s.name}</div>}
                      <RiskOMeter risk={s.risk} sidUrl={s.sidUrl} schemeName={s.name} size={190} />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card stack">
          <Field label="Payment mode" hint={needsMandate ? 'SIP, STP and SWP instructions require an active eNACH mandate.' : 'Choose how the purchase amount will be paid.'}>
            <Select
              value={paymentMode}
              onChange={(e) => {
                setPaymentMode(e.target.value);
                setPaymentTouched(true);
              }}
              options={PAYMENT_MODES}
            />
          </Field>
          <Checkbox
            checked={ack}
            onChange={(e) => {
              setAck(e.target.checked);
              if (e.target.checked) setSubmitError(null);
            }}
            label={
              staff
                ? 'I confirm the client has been informed of the scheme documents and the risk level of each scheme, and the client will approve these orders.'
                : 'I have read the scheme documents and understand the risk.'
            }
          />
          <StandardDisclaimer compact />
          {submitError && <Alert type="error">{submitError}</Alert>}
          <div className="row">
            <Button variant="ghost" onClick={() => setStage('build')} disabled={submitting}>
              ← Edit cart
            </Button>
            <Button variant="gold" size="lg" onClick={submit} loading={submitting} disabled={!ack}>
              {staff ? 'Send to client for approval' : 'Confirm & place order'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Build ----------
  const amountLabel = type === 'SIP' ? 'Monthly SIP amount' : type === 'STP' ? 'Monthly transfer amount' : type === 'SWP' ? 'Monthly withdrawal amount' : 'Amount';
  return (
    <div className="cart-builder">
      {staff && (
        <Alert type="info" title="Orders need client approval">
          Orders you place are created as PENDING_APPROVAL. The client must approve each order with an OTP from their Orders page before it is sent to the exchange.
        </Alert>
      )}
      {preErr && <Alert type="error">{preErr}</Alert>}
      <div className="cart-builder__grid">
        <section className="card" aria-labelledby="cb-form-title">
          <h2 id="cb-form-title" className="sr-only">
            Add a transaction
          </h2>
          <Tabs tabs={TYPES} value={type} onChange={changeType} label="Transaction type" />
          <p className="small muted">{TYPE_HELP[type]}</p>
          <div className="stack">
            {['LUMPSUM', 'SIP'].includes(type) && <SchemePicker value={form.scheme} onChange={set('scheme')} error={errors.scheme} />}

            {FOLIO_TYPES.includes(type) &&
              (myHoldings.length ? (
                <Field label="From folio" error={errors.folioId} required>
                  <Select
                    value={form.folioId}
                    onChange={(e) => setForm((f) => ({ ...f, folioId: e.target.value, target: null }))}
                    placeholder="Select a holding"
                    options={myHoldings.map((h) => ({ value: String(h.folioId), label: `${h.schemeName} — Folio ${h.folioNo} (${formatINR(h.value, { decimals: 0 })})` }))}
                  />
                </Field>
              ) : (
                <Alert type="info">There are no holdings to {type === 'REDEEM' ? 'redeem' : type === 'SWP' ? 'withdraw from' : 'transfer from'} yet.</Alert>
              ))}

            {holding && FOLIO_TYPES.includes(type) && (
              <div className="picked small">
                <div>
                  <div>
                    Units <strong className="num">{formatUnits(holding.units)}</strong> · NAV <span className="num">{formatNav(holding.nav)}</span>
                  </div>
                  <div>
                    Current value <strong className="num">{formatINR(holding.value)}</strong>
                  </div>
                </div>
                <RiskBadge risk={holding.risk} />
              </div>
            )}

            {['SWITCH', 'STP'].includes(type) && holding && (
              <SchemePicker label="To scheme" value={form.target} onChange={set('target')} amc={holding.amc} excludeId={holding.schemeId} error={errors.target} />
            )}

            {['REDEEM', 'SWITCH'].includes(type) && holding && (
              <fieldset className="radio-row">
                <legend className="field__label">{type === 'REDEEM' ? 'Redeem by' : 'Switch by'}</legend>
                {[
                  ['amount', 'Amount'],
                  ['units', 'Units'],
                  ['all', 'All units'],
                ].map(([v, l]) => (
                  <label key={v} className="check">
                    <input type="radio" name="cb-by" value={v} checked={form.by === v} onChange={set('by')} />
                    <span>{l}</span>
                  </label>
                ))}
              </fieldset>
            )}

            {(['LUMPSUM', 'SIP', 'STP', 'SWP'].includes(type) || (['REDEEM', 'SWITCH'].includes(type) && form.by === 'amount')) && (
              <Field
                label={amountLabel}
                error={errors.amount}
                required
                hint={
                  type === 'LUMPSUM' && form.scheme?.minLumpsum
                    ? `Minimum ${formatINR(form.scheme.minLumpsum, { decimals: 0 })}`
                    : type === 'SIP' && form.scheme?.minSip
                      ? `Minimum ${formatINR(form.scheme.minSip, { decimals: 0 })} per month`
                      : undefined
                }
              >
                <MoneyInput value={form.amount} onChange={set('amount')} step="1" />
              </Field>
            )}

            {['REDEEM', 'SWITCH'].includes(type) && form.by === 'units' && (
              <Field label="Units" error={errors.units} required>
                <Input type="number" inputMode="decimal" min="0" step="0.001" value={form.units} onChange={set('units')} />
              </Field>
            )}

            {RECURRING.includes(type) && (
              <div className="form-grid form-grid--2">
                <Field label={type === 'SWP' ? 'Withdrawal date (day of month)' : 'Debit / transfer date (day of month)'} required>
                  <Select value={form.sipDay} onChange={set('sipDay')} options={DAYS} />
                </Field>
                <Field label="Number of instalments" error={errors.installments} hint={`${Math.floor((Number(form.installments) || 0) / 12)} years ${(Number(form.installments) || 0) % 12} months`} required>
                  <Input type="number" inputMode="numeric" min="1" max="600" value={form.installments} onChange={set('installments')} />
                </Field>
              </div>
            )}

            <div className="row">
              <Button onClick={addToCart}>
                <Icon name="plus" size={18} /> Add to cart
              </Button>
            </div>
          </div>
        </section>

        <aside className="card cart-summary" aria-labelledby="cb-cart-title">
          <div className="card__head">
            <h2 id="cb-cart-title" className="card__title">
              Cart
            </h2>
            <span className="chip chip--navy">{cart.length}</span>
          </div>
          {cart.length ? cartList : <p className="small muted">Your cart is empty. Add one or more transactions, then review them together.</p>}
          <Button block variant="gold" disabled={!cart.length} onClick={() => setStage('review')} style={{ marginTop: '1rem' }}>
            Review order{cart.length > 1 ? 's' : ''}
          </Button>
        </aside>
      </div>

      {cart.length > 0 && (
        <div className="cart-bar">
          <Button variant="outline-gold" size="sm" onClick={() => setCartOpen(true)} aria-haspopup="dialog">
            <Icon name="cart" size={18} /> Cart ({cart.length})
          </Button>
          <Button variant="gold" size="sm" onClick={() => setStage('review')}>
            Review
          </Button>
        </div>
      )}

      <Drawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title={`Your cart (${cart.length})`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCartOpen(false)}>
              Add more
            </Button>
            <Button
              variant="gold"
              disabled={!cart.length}
              onClick={() => {
                setCartOpen(false);
                setStage('review');
              }}
            >
              Review order
            </Button>
          </>
        }
      >
        {cart.length ? cartList : <p className="muted">Your cart is empty.</p>}
        <p className="small muted" style={{ marginTop: '1rem' }}>
          You can review the risk level and scheme documents of each scheme before placing the order. <Link to="/funds">Explore funds</Link>
        </p>
      </Drawer>
    </div>
  );
}
