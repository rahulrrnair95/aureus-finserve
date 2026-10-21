import { useState } from 'react';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import { Checkbox, Field, Input, MoneyInput, Select } from '../../components/Field';
import { ProgressBar } from '../../components/Misc';
import { Alert, Async, EmptyState } from '../../components/States';
import { SkeletonBlock, SkeletonCards } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { formatDate, formatINR, formatPct, toISODate } from '../../utils/format';
import { PageTitle } from './parts/common';

const TYPES = [
  { value: 'RETIREMENT', label: 'Retirement', icon: 'sun' },
  { value: 'EDUCATION', label: 'Child education', icon: 'graduation' },
  { value: 'HOUSE', label: 'Home purchase', icon: 'home' },
  { value: 'WEALTH', label: 'Wealth creation', icon: 'leaf' },
  { value: 'OTHER', label: 'Other goal', icon: 'target' },
];
const typeOf = (t) => TYPES.find((x) => x.value === t) || TYPES[4];

export default function Goals() {
  useTitle('Goals');
  const toast = useToast();
  const q = useApi(() => investorApi.goals(), []);
  const [editing, setEditing] = useState(null); // goal | {} for new
  const [del, setDel] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');

  const doDelete = async () => {
    setDelBusy(true);
    setDelErr('');
    try {
      await investorApi.deleteGoal(del.id);
      q.setData((l) => (l || []).filter((g) => g.id !== del.id));
      toast.success(`Goal “${del.name}” deleted.`);
      setDel(null);
    } catch (e) {
      setDelErr(friendlyError(e));
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Planning" title="Your goals">
        <Button size="sm" onClick={() => setEditing({})}>
          <Icon name="plus" size={16} /> New goal
        </Button>
      </PageTitle>
      <Async
        state={q}
        skeleton={<SkeletonCards count={3} height={190} />}
        empty={(d) => !d?.length}
        emptyView={
          <div className="card">
            <EmptyState title="No goals yet" icon="target" action={<Button onClick={() => setEditing({})}>Create your first goal</Button>}>
              Give your investments a purpose — link folios to a goal such as retirement or a child’s education and track progress.
            </EmptyState>
          </div>
        }
      >
        {(goals) => (
          <ul className="grid grid-3 inv-cards">
            {goals.map((g) => {
              const t = typeOf(g.type);
              return (
                <li key={g.id} className="card inv-goal">
                  <article aria-labelledby={`goal-${g.id}`}>
                    <div className="inv-goal__head">
                      <span className="inv-goal__icon" aria-hidden="true">
                        <Icon name={t.icon} size={22} />
                      </span>
                      <div>
                        <h2 id={`goal-${g.id}`} className="inv-goal__name">
                          {g.name}
                        </h2>
                        <span className="tiny muted">{t.label}</span>
                      </div>
                    </div>
                    <div className="inv-goal__fig">
                      <span className="num">{formatINR(g.currentValue, { decimals: 0 })}</span>
                      <span className="small muted"> of {formatINR(g.targetAmount, { decimals: 0 })}</span>
                    </div>
                    <ProgressBar value={g.progressPct} label={`${g.name}: ${formatPct(g.progressPct, { decimals: 0 })} of target`} />
                    <div className="row row--between tiny muted inv-goal__meta">
                      <span>{formatPct(g.progressPct, { decimals: 0 })} achieved</span>
                      <span>Target {formatDate(g.targetDate)}</span>
                    </div>
                    <p className="tiny muted" style={{ margin: '0.25rem 0 0' }}>
                      {g.folioIds?.length || 0} linked folio{g.folioIds?.length === 1 ? '' : 's'}
                    </p>
                    <div className="row inv-goal__actions">
                      <Button variant="outline" size="sm" onClick={() => setEditing(g)} aria-label={`Edit goal ${g.name}`}>
                        <Icon name="edit" size={16} /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => (setDelErr(''), setDel(g))} aria-label={`Delete goal ${g.name}`}>
                        <Icon name="trash" size={16} /> Delete
                      </Button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
      <p className="tiny muted">Goal progress is based on the current value of linked folios and is for tracking only; it is not a projection of future returns.</p>

      {editing && (
        <GoalModal
          goal={editing}
          onClose={() => setEditing(null)}
          onSaved={(g, isNew) => {
            q.setData((l) => (isNew ? [...(l || []), g] : (l || []).map((x) => (x.id === g.id ? g : x))));
            toast.success(isNew ? 'Goal created.' : 'Goal updated.');
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog open={!!del} title="Delete goal" danger confirmLabel="Delete goal" loading={delBusy} error={delErr} onConfirm={doDelete} onClose={() => !delBusy && setDel(null)}>
        {del && (
          <p style={{ margin: 0 }}>
            Delete the goal <strong>{del.name}</strong>? Your investments are not affected — only the goal and its folio links are removed.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

function GoalModal({ goal, onClose, onSaved }) {
  const isNew = !goal.id;
  const holdings = useApi(() => investorApi.holdings(), []);
  const [form, setForm] = useState({
    name: goal.name || '',
    type: goal.type || 'WEALTH',
    targetAmount: goal.targetAmount ?? '',
    targetDate: goal.targetDate || '',
    folioIds: (goal.folioIds || []).map(Number),
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = toISODate(new Date());

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (id) => setForm((f) => ({ ...f, folioIds: f.folioIds.includes(id) ? f.folioIds.filter((x) => x !== id) : [...f.folioIds, id] }));

  const submit = async (e) => {
    e?.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Give your goal a name.';
    if (!form.targetAmount || Number(form.targetAmount) <= 0) errs.targetAmount = 'Enter a target amount greater than zero.';
    if (!form.targetDate) errs.targetDate = 'Choose a target date.';
    else if (form.targetDate <= today) errs.targetDate = 'The target date must be in the future.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError('');
    const body = { name: form.name.trim(), type: form.type, targetAmount: Number(form.targetAmount), targetDate: form.targetDate, folioIds: form.folioIds };
    try {
      const g = isNew ? await investorApi.createGoal(body) : await investorApi.updateGoal(goal.id, body);
      onSaved(g, isNew);
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={isNew ? 'New goal' : 'Edit goal'}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="inv-goal-form" loading={busy}>
            {isNew ? 'Create goal' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="inv-goal-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid form-grid--2">
          <Field label="Goal name" required error={errors.name} className="span-2">
            <Input value={form.name} onChange={set('name')} maxLength={100} placeholder="e.g. Aarav’s college fund" />
          </Field>
          <Field label="Goal type" required error={errors.type}>
            <Select value={form.type} onChange={set('type')} options={TYPES.map(({ value, label }) => ({ value, label }))} />
          </Field>
          <Field label="Target date" required error={errors.targetDate}>
            <Input type="date" min={today} value={form.targetDate} onChange={set('targetDate')} />
          </Field>
          <Field label="Target amount" required error={errors.targetAmount} className="span-2" hint={form.targetAmount ? formatINR(form.targetAmount, { decimals: 0 }) : undefined}>
            <MoneyInput value={form.targetAmount} onChange={set('targetAmount')} step="1000" />
          </Field>
        </div>
        <fieldset className="inv-fieldset">
          <legend className="field__label">Linked folios</legend>
          {holdings.loading && !holdings.data ? (
            <SkeletonBlock rows={3} />
          ) : holdings.error && !holdings.data ? (
            <Alert type="error">Could not load your folios. {friendlyError(holdings.error)}</Alert>
          ) : !holdings.data?.length ? (
            <p className="small muted" style={{ margin: 0 }}>
              You have no folios yet. You can link them later.
            </p>
          ) : (
            <div className="stack inv-folio-list">
              {holdings.data.map((h) => (
                <Checkbox
                  key={h.folioId}
                  checked={form.folioIds.includes(Number(h.folioId))}
                  onChange={() => toggle(Number(h.folioId))}
                  label={
                    <>
                      {h.schemeName}
                      <span className="tiny muted" style={{ display: 'block' }}>
                        Folio {h.folioNo} · {formatINR(h.value, { decimals: 0 })}
                      </span>
                    </>
                  }
                />
              ))}
            </div>
          )}
          {errors.folioIds && (
            <span className="field__error" role="alert">
              {errors.folioIds}
            </span>
          )}
        </fieldset>
        {error && <Alert type="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
