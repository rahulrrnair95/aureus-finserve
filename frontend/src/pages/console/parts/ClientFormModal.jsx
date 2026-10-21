import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import { Field, Input, Select, Textarea } from '../../../components/Field';
import { Alert } from '../../../components/States';
import { friendlyError } from '../../../api/client';
import { adminApi } from '../../../api/endpoints';
import { useApi } from '../../../api/useApi';
import { humanize } from '../../../utils/format';
import { EMAIL_RE, KYC_STATUSES, MOBILE_RE, PAN_RE, RELATIONS, fieldErrors, opts } from './common';
import { CopyField } from './ui';

const EMPTY = { name: '', pan: '', dob: '', email: '', mobile: '', address: '', kycStatus: 'VALIDATED', rmId: '', familyHeadId: '', relation: 'SPOUSE' };

function fromClient(c) {
  return {
    ...EMPTY,
    name: c.name || '',
    pan: '',
    dob: c.dob || '',
    email: c.email || '',
    mobile: '',
    address: c.address || '',
    kycStatus: c.kycStatus || 'VALIDATED',
    rmId: c.rmId ? String(c.rmId) : '',
    familyHeadId: c.familyHeadId && c.familyHeadId !== c.id ? String(c.familyHeadId) : '',
    relation: c.relation && c.relation !== 'SELF' ? c.relation : 'SPOUSE',
  };
}

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = 'Enter the client’s full name.';
  if (!PAN_RE.test(f.pan)) e.pan = 'PAN must look like AAAAA9999A.';
  if (!f.dob) e.dob = 'Enter the date of birth.';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.';
  if (!MOBILE_RE.test(f.mobile)) e.mobile = 'Enter a 10-digit mobile number.';
  if (!f.kycStatus) e.kycStatus = 'Choose the KYC status.';
  if (f.familyHeadId && !f.relation) e.relation = 'Choose the relation to the family head.';
  return e;
}

/**
 * Create (POST /admin/clients → shows activation link) or edit (PUT /admin/clients/{id}, ADMIN).
 * props: open, onClose, isAdmin, client? (edit), onSaved(client)
 */
export default function ClientFormModal({ open, onClose, isAdmin, client, onSaved }) {
  const editing = !!client;
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(client ? fromClient(client) : EMPTY);
      setErrors({});
      setError(null);
      setResult(null);
    }
  }, [open, client]);

  const rms = useApi(() => adminApi.rms(), [open], { enabled: open && isAdmin });
  const clients = useApi(() => adminApi.clients({}), [open], { enabled: open });
  const headOptions = useMemo(
    () =>
      (clients.data || [])
        .filter((c) => !client || c.id !== client.id)
        .filter((c) => !c.familyHeadId || c.familyHeadId === c.id)
        .map((c) => ({ value: String(c.id), label: `${c.name} (${c.panMasked || '—'})` })),
    [clients.data, client],
  );

  const set = (k) => (e) => {
    let v = e.target.value;
    if (k === 'pan') v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (k === 'mobile') v = v.replace(/\D/g, '').slice(0, 10);
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    const body = {
      name: form.name.trim(),
      pan: form.pan,
      dob: form.dob,
      email: form.email.trim(),
      mobile: form.mobile,
      address: form.address.trim(),
      kycStatus: form.kycStatus,
      familyHeadId: form.familyHeadId ? Number(form.familyHeadId) : null,
      relation: form.familyHeadId ? form.relation : null,
    };
    if (isAdmin && form.rmId) body.rmId = Number(form.rmId);
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const saved = await adminApi.updateClient(client.id, body);
        onSaved?.(saved);
        onClose();
      } else {
        const res = await adminApi.createClient(body);
        setResult(res);
        onSaved?.(res.client);
      }
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const formId = editing ? 'con-client-edit' : 'con-client-new';

  if (result) {
    return (
      <Modal open={open} onClose={onClose} title="Client created" footer={<Button onClick={onClose}>Done</Button>}>
        <div className="stack">
          <Alert type="success" title={`${result.client?.name || 'Client'} has been added.`}>
            Share the activation link so the client can set up online access.
          </Alert>
          <CopyField label="Activation link" value={result.activationLink} hint="Valid for 7 days. It has also been sent to the client by SMS and email." />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={editing ? `Edit ${client.name}` : 'New client'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {editing ? 'Save changes' : 'Create client'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="stack">
        {error && <Alert type="error">{error}</Alert>}
        <div className="form-grid form-grid--2">
          <Field label="Full name (as per PAN)" required error={errors.name} className="span-2">
            <Input value={form.name} onChange={set('name')} autoComplete="off" data-autofocus />
          </Field>
          <Field label="PAN" required error={errors.pan} hint={editing ? `Re-enter full PAN (on record: ${client.panMasked || '—'})` : 'Format AAAAA9999A'}>
            <Input value={form.pan} onChange={set('pan')} autoCapitalize="characters" autoComplete="off" pattern="[A-Z]{5}[0-9]{4}[A-Z]" maxLength={10} spellCheck={false} />
          </Field>
          <Field label="Date of birth" required error={errors.dob}>
            <Input type="date" value={form.dob} onChange={set('dob')} max={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <Input type="email" value={form.email} onChange={set('email')} autoComplete="off" />
          </Field>
          <Field label="Mobile" required error={errors.mobile} hint={editing ? `Re-enter full mobile (on record: ${client.mobileMasked || '—'})` : '10 digits, no country code'}>
            <Input type="tel" inputMode="numeric" value={form.mobile} onChange={set('mobile')} autoComplete="off" pattern="\d{10}" maxLength={10} />
          </Field>
          <Field label="Address" error={errors.address} className="span-2">
            <Textarea rows={2} value={form.address} onChange={set('address')} />
          </Field>
          <Field label="KYC status" required error={errors.kycStatus}>
            <Select value={form.kycStatus} onChange={set('kycStatus')} options={opts(KYC_STATUSES)} />
          </Field>
          {isAdmin && (
            <Field label="Relationship manager" error={errors.rmId} hint={rms.error ? 'Could not load RMs.' : undefined}>
              <Select value={form.rmId} onChange={set('rmId')} placeholder="Unassigned" options={(rms.data || []).map((r) => ({ value: String(r.id), label: `${r.name}${r.euin ? ` (${r.euin})` : ''}` }))} />
            </Field>
          )}
          <Field label="Family head (optional)" error={errors.familyHeadId} hint="Link this client to an existing family.">
            <Select value={form.familyHeadId} onChange={set('familyHeadId')} placeholder={clients.loading ? 'Loading clients…' : 'None — this client is a family head'} options={headOptions} />
          </Field>
          {form.familyHeadId && (
            <Field label="Relation to family head" required error={errors.relation}>
              <Select value={form.relation} onChange={set('relation')} options={RELATIONS.map((r) => ({ value: r, label: humanize(r) }))} />
            </Field>
          )}
        </div>
      </form>
    </Modal>
  );
}
