import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import StatusChip from '../../components/StatusChip';
import { Field, Input } from '../../components/Field';
import { PageHead } from '../../components/Misc';
import { Alert } from '../../components/States';
import { publicApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { formatDateTime } from '../../utils/format';
import { KYC_FLOW, KYC_TIMELINE, kycStatusLabel } from '../../utils/kyc';
import { MOBILE_RE } from './parts/content';

/** Public KYC application tracker: reference number + mobile → status with a friendly timeline. */
export default function KycStatus() {
  useTitle('Track your KYC application');
  const [params] = useSearchParams();
  const [f, setF] = useState({ ref: (params.get('ref') || '').toUpperCase(), mobile: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^KYC\d{6,}$/.test(f.ref.trim())) errs.ref = 'Enter the reference number from your confirmation, e.g. KYC2610200001.';
    if (!MOBILE_RE.test(f.mobile)) errs.mobile = 'Enter the 10-digit mobile number you used in the application.';
    setErrors(errs);
    setError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      setResult(await publicApi.kycStatus({ ref: f.ref.trim(), mobile: f.mobile }));
    } catch (err) {
      setResult(null);
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead eyebrow="Online KYC" title="Track your KYC application" lead="Enter your reference number and the mobile number you applied with." />
      <section className="section pub-tight-top">
        <div className="container pub-narrow stack-lg">
          <form className="card pub-form-card" onSubmit={onSubmit} noValidate aria-label="Find your application">
            <div className="form-grid form-grid--2">
              <Field label="Reference number" error={errors.ref} hint="Starts with KYC" required>
                <Input value={f.ref} onChange={(e) => setF((s) => ({ ...s, ref: e.target.value.toUpperCase().replace(/\s/g, '') }))} autoComplete="off" spellCheck={false} />
              </Field>
              <Field label="Mobile number" error={errors.mobile} required>
                <Input value={f.mobile} onChange={(e) => setF((s) => ({ ...s, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} inputMode="numeric" autoComplete="tel-national" />
              </Field>
            </div>
            <div className="row" style={{ marginTop: '1rem' }}>
              <Button type="submit" loading={busy}>
                Check status
              </Button>
              <span className="small muted">
                No application yet? <Link to="/kyc">Start your KYC</Link>
              </span>
            </div>
          </form>

          {error && (
            <Alert type={error.code === 'NOT_FOUND' ? 'warning' : 'error'} title={error.code === 'NOT_FOUND' ? 'No matching application' : undefined}>
              {error.code === 'NOT_FOUND' ? 'We could not find an application with this reference number and mobile number. Please check both and try again, or call our office.' : friendlyError(error)}
            </Alert>
          )}

          {result && <StatusCard r={result} focusRef={resultRef} />}
        </div>
      </section>
    </>
  );
}

function StatusCard({ r, focusRef }) {
  const idx = KYC_FLOW.indexOf(r.status);
  const side = r.status === 'ACTION_REQUIRED' || r.status === 'REJECTED';
  return (
    <section className="card card--accent pub-kyc-track" aria-labelledby="kyc-track-h">
      <div className="row row--between">
        <h2 id="kyc-track-h" ref={focusRef} tabIndex={-1} className="card__title" style={{ margin: 0 }}>
          Application <span className="num">{r.ref}</span>
        </h2>
        <StatusChip status={r.status} label={kycStatusLabel(r.status)} />
      </div>
      <p className="small muted" style={{ marginTop: '0.5rem' }}>
        Submitted {formatDateTime(r.submittedAt)} · last updated {formatDateTime(r.updatedAt)}
      </p>
      <Alert type={r.status === 'REJECTED' ? 'error' : r.status === 'ACTION_REQUIRED' ? 'warning' : r.status === 'KYC_REGISTERED' ? 'success' : 'info'}>{r.message}</Alert>
      <ol className="pub-kyc-timeline" aria-label="Progress">
        {KYC_TIMELINE.map((s, i) => {
          const state = side ? (i === 0 ? 'done' : 'todo') : i < idx ? 'done' : i === idx ? (r.status === 'KYC_REGISTERED' ? 'done' : 'current') : 'todo';
          return (
            <li key={s.status} className={`is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="pub-kyc-timeline__dot" aria-hidden="true">
                {state === 'done' ? <Icon name="check" size={14} strokeWidth={2.6} /> : i + 1}
              </span>
              <div>
                <strong>{s.title}</strong>
                <span className="sr-only">{state === 'done' ? ' — done' : state === 'current' ? ' — in progress' : ' — to come'}</span>
                <p className="small muted">{s.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="small muted" style={{ margin: 0 }}>
        Questions? <Link to="/contact">Contact us</Link> and quote your reference number.
      </p>
    </section>
  );
}
