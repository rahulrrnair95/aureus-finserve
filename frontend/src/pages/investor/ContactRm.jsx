import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { Field, Select, Textarea } from '../../components/Field';
import { Alert, Async } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { PageTitle, telLink, waLink } from './parts/common';

const SLOTS = ['Morning (9 am – 12 pm)', 'Afternoon (12 pm – 4 pm)', 'Evening (4 pm – 7 pm)'];

export default function ContactRm() {
  useTitle('Contact my RM');
  const q = useApi(() => investorApi.rm(), []);
  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Support" title="Your relationship manager" />
      <div className="inv-ov-grid">
        <Async state={q} skeleton={<SkeletonBlock rows={5} />}>
          {(r) => <RmDetails r={r} />}
        </Async>
        <CallbackForm />
      </div>
    </div>
  );
}

function RmDetails({ r }) {
  const tel = telLink(r.phone);
  const wa = waLink(r.whatsapp || r.phone);
  const initials = (r.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  return (
    <section className="card card--navy on-navy inv-rm-card" aria-labelledby="inv-rm-name">
      <div className="inv-rm__who">
        <span className="inv-rm__avatar inv-rm__avatar--gold" aria-hidden="true">
          {initials}
        </span>
        <div>
          <span className="eyebrow">Relationship manager</span>
          <h2 id="inv-rm-name" className="card__title" style={{ margin: 0 }}>
            {r.name}
          </h2>
          {r.euin && <span className="small">EUIN {r.euin}</span>}
        </div>
      </div>
      <span className="gold-rule" aria-hidden="true" />
      <ul className="inv-contact-list">
        {r.phone && (
          <li>
            <Icon name="phone" size={18} />
            <span className="sr-only">Phone: </span>
            <a href={tel}>{r.phone}</a>
          </li>
        )}
        {wa && (
          <li>
            <Icon name="chat" size={18} />
            <a href={wa} target="_blank" rel="noopener noreferrer">
              Message on WhatsApp<span className="sr-only"> (opens in new tab)</span>
            </a>
          </li>
        )}
        {r.email && (
          <li>
            <Icon name="mail" size={18} />
            <span className="sr-only">Email: </span>
            <a href={`mailto:${r.email}`}>{r.email}</a>
          </li>
        )}
      </ul>
      <p className="small" style={{ color: 'var(--on-navy-muted)', margin: '1rem 0 0' }}>
        Your RM can help with investments, SIPs, KYC and account changes.
      </p>
    </section>
  );
}

function CallbackForm() {
  const [slot, setSlot] = useState(SLOTS[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    try {
      await investorApi.rmCallback({ preferredTime: slot, note: note.trim() });
      setDone(true);
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="inv-cb-h">
      <h2 id="inv-cb-h" className="card__title">
        Request a call back
      </h2>
      {done ? (
        <div className="stack">
          <Alert type="success" title="Request received">
            Your RM has been notified and will call you in your preferred {slot.split(' ')[0].toLowerCase()} slot. You can track this under <Link to="/app/service">Service requests</Link>.
          </Alert>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDone(false);
              setNote('');
            }}
          >
            Request another call back
          </Button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <Field label="Preferred time" required error={errors.preferredTime}>
            <Select value={slot} onChange={(e) => setSlot(e.target.value)} options={SLOTS} />
          </Field>
          <Field label="What would you like to discuss?" hint="Optional. Please do not share passwords or OTPs." error={errors.note}>
            <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
          {error && <Alert type="error">{error}</Alert>}
          <div>
            <Button type="submit" loading={busy}>
              Request call back
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
