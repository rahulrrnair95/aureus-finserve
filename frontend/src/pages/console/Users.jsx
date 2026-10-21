import { useState } from 'react';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { useAuth } from '../../auth/AuthContext';
import { formatDateTime } from '../../utils/format';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import { Field, Input, Select } from '../../components/Field';
import { Alert, Async, EmptyState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import { EMAIL_RE, MOBILE_RE, fieldErrors } from './parts/common';
import { CopyField, PageTitle, RowButton } from './parts/ui';

const EMPTY = { name: '', email: '', mobile: '', role: 'RM', euin: '' };
const EUIN_RE = /^E\d{6}$/;

const ACTIONS = {
  reset: { title: 'Reset password?', label: 'Reset password', body: (u) => `A new temporary password will be generated for ${u.name}. They must change it at next login.` },
  logout: { title: 'Force logout?', label: 'Force logout', body: (u) => `${u.name} will be signed out of every active session immediately.`, danger: true },
  status: {
    title: (u) => (u.enabled ? 'Disable this user?' : 'Enable this user?'),
    label: (u) => (u.enabled ? 'Disable' : 'Enable'),
    body: (u) => (u.enabled ? `${u.name} will be signed out and unable to log in.` : `${u.name} will be able to log in again.`),
    danger: (u) => u.enabled,
  },
};
const val = (x, u) => (typeof x === 'function' ? x(u) : x);

export default function Users() {
  useTitle('Users');
  const { user: me } = useAuth();
  const toast = useToast();
  const list = useApi(() => adminApi.users(), []);
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState(null); // { kind, user }
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState(null);
  const [secret, setSecret] = useState(null); // { name, tempPassword }

  const runAction = async () => {
    const { kind, user: u } = action;
    setBusy(true);
    setActionErr(null);
    try {
      if (kind === 'reset') {
        const res = await adminApi.resetUserPassword(u.id);
        setSecret({ name: u.name, tempPassword: res.tempPassword });
      } else if (kind === 'logout') {
        await adminApi.forceLogout(u.id);
        toast.success(`${u.name} has been signed out.`);
      } else {
        const res = await adminApi.userStatus(u.id, !u.enabled);
        list.setData((rows) => rows.map((r) => (r.id === u.id ? { ...r, ...res } : r)));
        toast.success(`${u.name} ${u.enabled ? 'disabled' : 'enabled'}.`);
      }
      setAction(null);
    } catch (err) {
      setActionErr(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'name', header: 'Name', primary: true },
    { key: 'email', header: 'Email' },
    { key: 'mobileMasked', header: 'Mobile', render: (r) => <span className="num">{r.mobileMasked || '—'}</span> },
    { key: 'role', header: 'Role', render: (r) => <span className={`chip ${r.role === 'ADMIN' ? 'chip--navy' : 'chip--gold'}`}>{r.role}</span> },
    { key: 'euin', header: 'EUIN', render: (r) => r.euin || '—' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span className="row con-chips">
          <StatusChip status={r.enabled ? 'ENABLED' : 'DISABLED'} />
          {r.loginStatus && r.loginStatus !== 'ACTIVE' && r.loginStatus !== 'DISABLED' && <StatusChip status={r.loginStatus} />}
        </span>
      ),
    },
    { key: 'lastLoginAt', header: 'Last login', render: (r) => (r.lastLoginAt ? formatDateTime(r.lastLoginAt) : 'Never') },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (r) => {
        const self = me && String(me.id) === String(r.id);
        return (
          <div className="row con-row-actions">
            <RowButton variant="outline" onClick={() => setAction({ kind: 'reset', user: r })} aria-label={`Reset password for ${r.name}`}>
              Reset password
            </RowButton>
            <RowButton variant="ghost" disabled={self} onClick={() => setAction({ kind: 'logout', user: r })} aria-label={`Force logout ${r.name}`}>
              Force logout
            </RowButton>
            <RowButton variant={r.enabled ? 'danger' : 'primary'} disabled={self} onClick={() => setAction({ kind: 'status', user: r })} aria-label={`${r.enabled ? 'Disable' : 'Enable'} ${r.name}`}>
              {r.enabled ? 'Disable' : 'Enable'}
            </RowButton>
          </div>
        );
      },
    },
  ];

  const a = action && ACTIONS[action.kind];

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Administration" title="Staff users">
        <Button onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} /> New user
        </Button>
      </PageTitle>
      <Async state={list} skeleton={<SkeletonBlock rows={5} height={28} />} empty={(d) => !d.length} emptyView={<EmptyState title="No staff users" icon="shield" />}>
        {(rows) => <DataTable caption="Staff users" columns={columns} rows={rows} />}
      </Async>

      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(res) => {
          list.setData((rows) => [...(rows || []), res.user]);
          setCreating(false);
          setSecret({ name: res.user?.name, tempPassword: res.tempPassword, created: true });
        }}
      />

      {a && (
        <ConfirmDialog
          open
          title={val(a.title, action.user)}
          confirmLabel={val(a.label, action.user)}
          danger={!!val(a.danger, action.user)}
          loading={busy}
          error={actionErr}
          onConfirm={runAction}
          onClose={() => {
            setAction(null);
            setActionErr(null);
          }}
        >
          <p>{a.body(action.user)}</p>
        </ConfirmDialog>
      )}

      <Modal open={!!secret} title={secret?.created ? 'User created' : 'Password reset'} onClose={() => setSecret(null)} footer={<Button onClick={() => setSecret(null)}>I have saved it</Button>}>
        {secret && (
          <div className="stack">
            <Alert type="warning" title="Shown only once">
              Copy this temporary password now and share it securely with {secret.name}. It cannot be displayed again.
            </Alert>
            <CopyField label="Temporary password" value={secret.tempPassword} highlight hint="The user will be asked to set a new password after logging in." />
          </div>
        )}
      </Modal>
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setForm(EMPTY);
    setErrors({});
    setError(null);
    onClose();
  };
  const set = (k) => (e) => {
    let v = e.target.value;
    if (k === 'mobile') v = v.replace(/\D/g, '').slice(0, 10);
    if (k === 'euin') v = v.toUpperCase().replace(/\s/g, '');
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!form.name.trim()) v.name = 'Enter the name.';
    if (!EMAIL_RE.test(form.email.trim())) v.email = 'Enter a valid email address.';
    if (!MOBILE_RE.test(form.mobile)) v.mobile = 'Enter a 10-digit mobile number.';
    if (form.role === 'RM' && !EUIN_RE.test(form.euin)) v.euin = 'EUIN is required for RMs (format E123456).';
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminApi.createUser({ name: form.name.trim(), email: form.email.trim(), mobile: form.mobile, role: form.role, euin: form.euin || null });
      setForm(EMPTY);
      onCreated(res);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New staff user"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="con-user-form" loading={saving}>
            Create user
          </Button>
        </>
      }
    >
      <form id="con-user-form" className="stack" onSubmit={submit} noValidate>
        {error && <Alert type="error">{error}</Alert>}
        <Field label="Full name" required error={errors.name}>
          <Input value={form.name} onChange={set('name')} data-autofocus />
        </Field>
        <Field label="Email (login ID)" required error={errors.email}>
          <Input type="email" value={form.email} onChange={set('email')} autoComplete="off" />
        </Field>
        <Field label="Mobile" required error={errors.mobile} hint="10 digits — used for login OTPs">
          <Input type="tel" inputMode="numeric" value={form.mobile} onChange={set('mobile')} maxLength={10} />
        </Field>
        <Field label="Role" required error={errors.role}>
          <Select value={form.role} onChange={set('role')} options={['RM', 'ADMIN'].map((r) => ({ value: r, label: r === 'RM' ? 'Relationship manager (RM)' : 'Administrator' }))} />
        </Field>
        <Field label="EUIN" required={form.role === 'RM'} error={errors.euin} hint="Employee Unique Identification Number issued by AMFI, e.g. E123456. Required for RMs.">
          <Input value={form.euin} onChange={set('euin')} maxLength={7} autoComplete="off" />
        </Field>
        <p className="tiny muted">A temporary password is generated and shown once after creation.</p>
      </form>
    </Modal>
  );
}
