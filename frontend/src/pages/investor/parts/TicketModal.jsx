import { useEffect, useState } from 'react';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import { Field, Input, Select, Textarea } from '../../../components/Field';
import { Alert } from '../../../components/States';
import { investorApi } from '../../../api/endpoints';
import { friendlyError } from '../../../api/client';
import { TICKET_CATEGORIES, categoryLabel } from './common';

/**
 * Create a service request (ticket). onCreated(ticket) is called on success.
 * <TicketModal open category="ADDRESS_CHANGE" subject="…" onClose onCreated />
 */
export default function TicketModal({ open, onClose, onCreated, category = 'OTHER', subject = '', title = 'New service request', intro }) {
  const [form, setForm] = useState({ category, subject, description: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ category, subject, description: '' });
      setErrors({});
      setError('');
    }
  }, [open, category, subject]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e?.preventDefault();
    const errs = {};
    if (!form.category) errs.category = 'Choose a category.';
    if (!form.subject.trim()) errs.subject = 'Enter a short subject.';
    if (!form.description.trim()) errs.description = 'Describe what you need.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError('');
    try {
      const t = await investorApi.createTicket({ category: form.category, subject: form.subject.trim(), description: form.description.trim() });
      onCreated?.(t);
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="inv-ticket-form" loading={busy}>
            Submit request
          </Button>
        </>
      }
    >
      <form id="inv-ticket-form" className="stack" onSubmit={submit} noValidate>
        {intro && <p className="small muted">{intro}</p>}
        <Field label="Category" required error={errors.category}>
          <Select value={form.category} onChange={set('category')} options={TICKET_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))} />
        </Field>
        <Field label="Subject" required error={errors.subject}>
          <Input value={form.subject} onChange={set('subject')} maxLength={150} />
        </Field>
        <Field label="Details" required error={errors.description} hint="Please do not share passwords or OTPs. Our team may ask for supporting documents.">
          <Textarea rows={5} value={form.description} onChange={set('description')} maxLength={2000} />
        </Field>
        {error && <Alert type="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
