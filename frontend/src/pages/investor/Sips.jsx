import { useMemo, useState } from 'react';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useInvestor } from '../../layouts/InvestorLayout';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Field, Input, Select } from '../../components/Field';
import StatusChip from '../../components/StatusChip';
import { Async, EmptyState } from '../../components/States';
import { SkeletonCards } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { formatDate, formatINR, formatPct } from '../../utils/format';
import { FilterChips, InfoList, PageTitle } from './parts/common';

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export default function Sips() {
  useTitle('SIPs');
  const { memberParam, memberName } = useInvestor();
  const q = useApi(() => investorApi.sips(memberParam), [memberParam]);
  const [filter, setFilter] = useState('ALL');
  const [action, setAction] = useState(null); // { kind, sip }

  const replace = (sip) => q.setData((list) => (list || []).map((s) => (s.id === sip.id ? sip : s)));

  return (
    <div className="stack-lg">
      <PageTitle eyebrow={`Portfolio · ${memberName}`} title="Systematic investment plans">
        <Button size="sm" to="/app/transact?type=SIP">
          Start new SIP
        </Button>
      </PageTitle>
      <Async
        state={q}
        skeleton={<SkeletonCards count={4} height={200} />}
        empty={(d) => !d?.length}
        emptyView={
          <div className="card">
            <EmptyState
              title="No SIPs yet"
              icon="repeat"
              action={
                <Button to="/app/transact?type=SIP" variant="primary">
                  Start a SIP
                </Button>
              }
            >
              A systematic investment plan invests a fixed amount every month on a date you choose.
            </EmptyState>
          </div>
        }
      >
        {(list) => <SipList list={list} filter={filter} setFilter={setFilter} showInvestor={memberParam === 'all'} onAction={(kind, sip) => setAction({ kind, sip })} />}
      </Async>
      <SipActionDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={(sip) => {
          replace(sip);
          setAction(null);
        }}
      />
    </div>
  );
}

function SipList({ list, filter, setFilter, showInvestor, onAction }) {
  const counts = useMemo(() => {
    const c = { ALL: list.length, ACTIVE: 0, PAUSED: 0, CANCELLED: 0 };
    list.forEach((s) => {
      c[s.status] = (c[s.status] || 0) + 1;
    });
    return c;
  }, [list]);
  const shown = filter === 'ALL' ? list : list.filter((s) => s.status === filter);
  const monthly = list.filter((s) => s.status === 'ACTIVE').reduce((t, s) => t + (Number(s.amount) || 0), 0);

  return (
    <>
      <div className="row row--between">
        <FilterChips
          label="Filter SIPs by status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All', count: counts.ALL },
            { value: 'ACTIVE', label: 'Active', count: counts.ACTIVE },
            { value: 'PAUSED', label: 'Paused', count: counts.PAUSED },
            { value: 'CANCELLED', label: 'Cancelled', count: counts.CANCELLED },
          ]}
        />
        <p className="small muted" style={{ margin: 0 }}>
          Active monthly total: <strong className="num">{formatINR(monthly, { decimals: 0 })}</strong>
        </p>
      </div>
      {!shown.length ? (
        <div className="card">
          <EmptyState title="No SIPs with this status" icon="repeat" />
        </div>
      ) : (
        <ul className="grid grid-2 inv-cards" aria-live="polite">
          {shown.map((s) => (
            <li key={s.id} className="card inv-sip">
              <article aria-labelledby={`sip-${s.id}`}>
                <div className="inv-sip__head">
                  <h2 id={`sip-${s.id}`} className="inv-sip__name">
                    {s.schemeName}
                  </h2>
                  <StatusChip status={s.status} />
                </div>
                <p className="inv-sip__amount">
                  <span className="num">{formatINR(s.amount, { decimals: 0 })}</span>
                  <span className="small muted"> / month on the {ordinal(s.sipDay)}</span>
                </p>
                <InfoList
                  items={[
                    showInvestor && { label: 'Investor', value: s.investorName },
                    { label: 'Folio', value: s.folioNo || '—' },
                    { label: 'Next debit', value: s.status === 'ACTIVE' ? formatDate(s.nextDebitDate) : '—' },
                    { label: 'Started', value: formatDate(s.startDate) },
                    { label: 'Instalments done', value: s.installmentsDone ?? 0 },
                    { label: 'Annual step-up', value: s.stepUpPct ? formatPct(s.stepUpPct, { decimals: 0 }) : 'None' },
                    s.status === 'PAUSED' && s.pausedUntil && { label: 'Paused until', value: formatDate(s.pausedUntil) },
                  ]}
                />
                {s.status !== 'CANCELLED' && (
                  <div className="row inv-sip__actions">
                    {s.status === 'ACTIVE' && (
                      <Button variant="outline" size="sm" onClick={() => onAction('pause', s)}>
                        Pause
                      </Button>
                    )}
                    {s.status === 'PAUSED' && (
                      <Button variant="outline" size="sm" onClick={() => onAction('resume', s)}>
                        Resume
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => onAction('stepup', s)}>
                      Step-up
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onAction('cancel', s)}>
                      Cancel SIP
                    </Button>
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const TITLES = { pause: 'Pause SIP', resume: 'Resume SIP', stepup: 'Set annual step-up', cancel: 'Cancel SIP' };

function SipActionDialog({ action, onClose, onDone }) {
  const toast = useToast();
  const [months, setMonths] = useState('1');
  const [pct, setPct] = useState('10');
  const [fieldErr, setFieldErr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState(null);

  const key = action ? `${action.kind}-${action.sip.id}` : null;
  if (key !== lastId) {
    setLastId(key);
    setMonths('1');
    setPct(action?.sip.stepUpPct ? String(action.sip.stepUpPct) : '10');
    setFieldErr('');
    setError('');
  }

  if (!action) return null;
  const { kind, sip } = action;

  const confirm = async () => {
    setError('');
    setFieldErr('');
    if (kind === 'stepup') {
      const n = Number(pct);
      if (pct === '' || !Number.isFinite(n) || n < 5 || n > 50) {
        setFieldErr('Enter a whole number between 5 and 50.');
        return;
      }
    }
    setBusy(true);
    try {
      let res;
      if (kind === 'pause') res = await investorApi.pauseSip(sip.id, Number(months));
      else if (kind === 'resume') res = await investorApi.resumeSip(sip.id);
      else if (kind === 'stepup') res = await investorApi.stepUpSip(sip.id, Number(pct));
      else res = await investorApi.cancelSip(sip.id);
      toast.success(
        kind === 'pause'
          ? `SIP paused for ${months} month${months === '1' ? '' : 's'}.`
          : kind === 'resume'
            ? 'SIP resumed.'
            : kind === 'stepup'
              ? `Annual step-up set to ${pct}%.`
              : 'SIP cancelled.',
      );
      onDone(res && res.id ? res : { ...sip });
    } catch (e) {
      const f = e.fields?.months || e.fields?.stepUpPct;
      if (f) setFieldErr(f);
      else setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open
      title={TITLES[kind]}
      danger={kind === 'cancel'}
      confirmLabel={kind === 'cancel' ? 'Yes, cancel SIP' : kind === 'pause' ? 'Pause SIP' : kind === 'resume' ? 'Resume SIP' : 'Save step-up'}
      cancelLabel={kind === 'cancel' ? 'Keep SIP' : 'Cancel'}
      loading={busy}
      error={error}
      onConfirm={confirm}
      onClose={busy ? undefined : onClose}
    >
      <p style={{ margin: 0 }}>
        <strong>{sip.schemeName}</strong>
        <br />
        <span className="small muted">
          {formatINR(sip.amount, { decimals: 0 })} per month · Folio {sip.folioNo || '—'}
        </span>
      </p>
      {kind === 'pause' && (
        <Field label="Pause for" error={fieldErr} hint="Instalments due in this period will be skipped. The SIP resumes automatically afterwards.">
          <Select value={months} onChange={(e) => setMonths(e.target.value)} options={[1, 2, 3, 4, 5, 6].map((m) => ({ value: String(m), label: `${m} month${m > 1 ? 's' : ''}` }))} />
        </Field>
      )}
      {kind === 'resume' && <p style={{ margin: 0 }}>Your SIP will resume from the next eligible debit date.</p>}
      {kind === 'stepup' && (
        <Field label="Annual step-up (%)" error={fieldErr} hint="Your SIP amount increases by this percentage every year. Between 5% and 50%.">
          <Input type="number" inputMode="numeric" min={5} max={50} step={1} value={pct} onChange={(e) => setPct(e.target.value)} />
        </Field>
      )}
      {kind === 'cancel' && <p style={{ margin: 0 }}>Cancelling stops all future instalments. Units already allotted stay in your folio. This cannot be undone.</p>}
    </ConfirmDialog>
  );
}
