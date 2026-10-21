import { useState } from 'react';
import Button from '../../../components/Button';
import { Checkbox, Field, Input, PasswordInput } from '../../../components/Field';
import { Alert } from '../../../components/States';
import { publicApi } from '../../../api/endpoints';
import { friendlyError } from '../../../api/client';
import { CONSENT_TEXT, EMAIL_RE, MOBILE_RE } from './content';
import OtpStep from './OtpStep';

const MAX_BYTES = 10 * 1024 * 1024;
const OTP_CODES = ['OTP_INVALID', 'OTP_EXPIRED', 'OTP_ATTEMPTS_EXCEEDED'];

/** CAS upload form for the portfolio-review service (OTP verified). */
export default function PortfolioReviewForm() {
  const [f, setF] = useState({ name: '', mobile: '', email: '', casPassword: '', consent: false, website: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [step, setStep] = useState(1);
  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Please enter your name.';
    if (!MOBILE_RE.test(f.mobile)) e.mobile = 'Enter a valid 10-digit mobile number.';
    if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (!file) e.file = 'Please attach your CAS (PDF).';
    else if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) e.file = 'The file must be a PDF.';
    else if (file.size > MAX_BYTES) e.file = 'The file must be 10 MB or smaller.';
    if (!f.consent) e.consent = 'Please give your consent so we can contact you.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const sendOtp = async () => {
    const res = await publicApi.leadOtp(f.mobile);
    setChallenge(res);
    setOtp('');
    setOtpError('');
  };

  const onStart = async (ev) => {
    ev.preventDefault();
    setAlert('');
    if (!validate()) return;
    setBusy(true);
    try {
      await sendOtp();
      setStep(2);
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setAlert(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      await sendOtp();
    } catch (err) {
      setOtpError(friendlyError(err));
    } finally {
      setResending(false);
    }
  };

  const onSubmit = async () => {
    setBusy(true);
    setOtpError('');
    try {
      await publicApi.portfolioReview({
        name: f.name.trim(),
        mobile: f.mobile,
        email: f.email.trim(),
        consent: true,
        challengeId: challenge.challengeId,
        otp,
        casPassword: f.casPassword || undefined,
        website: f.website,
        file,
      });
      setDone(true);
    } catch (err) {
      if (OTP_CODES.includes(err.code)) setOtpError(friendlyError(err));
      else if (err.code === 'VALIDATION' && err.fields) {
        setErrors(err.fields);
        setAlert(friendlyError(err));
        setStep(1);
      } else setOtpError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card card--accent pub-success" role="status">
        <h3 className="card__title">Thank you — we have received your statement</h3>
        <p>Our team will review your portfolio and call you to walk you through what we observe. Your CAS is stored securely and used only for this review.</p>
        <Button variant="outline" to="/">
          Back to home
        </Button>
      </div>
    );
  }

  return (
    <div className="card pub-form-card">
      <h3 className="card__title">Request a portfolio review</h3>
      <p className="small muted">
        Upload your Consolidated Account Statement (CAS) from CAMS, KFintech, NSDL or CDSL. We verify your mobile number with an OTP before upload.
      </p>
      {alert && <Alert type="error">{alert}</Alert>}
      {step === 1 ? (
        <form onSubmit={onStart} noValidate className="stack">
          <div className="form-grid form-grid--2">
            <Field label="Full name" error={errors.name} required>
              <Input value={f.name} onChange={set('name')} autoComplete="name" />
            </Field>
            <Field label="Mobile number" error={errors.mobile} hint="10 digits, no country code" required>
              <Input value={f.mobile} onChange={(e) => setF((s) => ({ ...s, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} inputMode="numeric" autoComplete="tel-national" />
            </Field>
            <Field label="Email" error={errors.email} required className="span-2">
              <Input type="email" value={f.email} onChange={set('email')} autoComplete="email" />
            </Field>
            <Field label="CAS statement (PDF)" error={errors.file} hint="PDF only, up to 10 MB" required>
              <Input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </Field>
            <Field label="CAS password (optional)" error={errors.casPassword} hint="If your statement is password protected">
              <PasswordInput value={f.casPassword} onChange={set('casPassword')} autoComplete="off" />
            </Field>
          </div>
          <div className="pub-hp" aria-hidden="true">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} />
            </label>
          </div>
          <div>
            <Checkbox label={CONSENT_TEXT} checked={f.consent} onChange={set('consent')} aria-invalid={errors.consent ? 'true' : undefined} />
            {errors.consent && (
              <p className="field__error" role="alert">
                {errors.consent}
              </p>
            )}
          </div>
          <div>
            <Button type="submit" loading={busy}>
              Send OTP
            </Button>
          </div>
        </form>
      ) : (
        <OtpStep
          mobile={f.mobile}
          challengeId={challenge?.challengeId}
          devOtp={challenge?.devOtp}
          otp={otp}
          setOtp={setOtp}
          error={otpError}
          onSubmit={onSubmit}
          onResend={onResend}
          onBack={() => setStep(1)}
          submitting={busy}
          resending={resending}
          submitLabel="Verify and upload"
        />
      )}
    </div>
  );
}
