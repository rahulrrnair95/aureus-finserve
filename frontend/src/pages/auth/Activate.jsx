import { useState } from 'react';
import { useParams } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Button from '../../components/Button';
import { Field, Input, PasswordInput } from '../../components/Field';
import { Alert } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { authApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useApi } from '../../api/useApi';
import { passwordValid } from '../../utils/password';
import { useTitle } from '../../utils/useTitle';
import { OtpStep, PasswordChecklist } from './parts';

export default function Activate() {
  useTitle('Activate your account');
  const { token } = useParams();
  const check = useApi(() => authApi.activateCheck(token), [token]);
  const [step, setStep] = useState('verify');
  const [pan, setPan] = useState('');
  const [dob, setDob] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [fe, setFe] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [resendKey, setResendKey] = useState(0);

  const verify = async (e) => {
    e.preventDefault();
    setError(null);
    const f = {};
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) f.pan = 'Enter your PAN in the format AAAAA9999A.';
    if (!dob) f.dob = 'Enter your date of birth.';
    setFe(f);
    if (Object.keys(f).length) return;
    setBusy('verify');
    try {
      const res = await authApi.activateVerify({ token, pan, dob });
      setChallenge(res);
      setResendKey((k) => k + 1);
      setStep('password');
    } catch (err) {
      if (err.fields) setFe(err.fields);
      setError(err.code === 'VALIDATION' || err.code === 'NOT_FOUND' ? err.error || 'The details do not match our records.' : friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    setBusy('resend');
    setError(null);
    try {
      const res = await authApi.resendOtp(challenge.challengeId);
      setChallenge((c) => ({ ...c, ...res }));
      setOtp('');
      setResendKey((k) => k + 1);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const complete = async (e) => {
    e.preventDefault();
    setError(null);
    const f = {};
    if (!passwordValid(pw, { pan })) f.newPassword = 'Your password does not meet all the requirements.';
    if (pw !== pw2) f.confirm = 'Passwords do not match.';
    setFe(f);
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    if (Object.keys(f).length) return;
    setBusy('complete');
    try {
      await authApi.activateComplete({ challengeId: challenge.challengeId, otp, newPassword: pw });
      setStep('done');
    } catch (err) {
      if (err.fields) setFe(err.fields);
      setError(friendlyError(err));
      if (err.code?.startsWith('OTP_')) setOtp('');
    } finally {
      setBusy(null);
    }
  };

  let body;
  if (check.loading) body = <SkeletonBlock rows={4} />;
  else if (check.error)
    body = (
      <div className="stack">
        <Alert type="error" title="This activation link is not valid">
          {check.error.status === 404 ? 'The link may have expired (links are valid for 7 days) or has already been used.' : friendlyError(check.error)} Please ask your relationship manager to send you a new
          activation link.
        </Alert>
        <Button to="/contact" variant="outline">
          Contact us
        </Button>
      </div>
    );
  else if (step === 'verify')
    body = (
      <form onSubmit={verify} noValidate className="stack">
        <p className="muted">
          Welcome{check.data?.name ? `, ${check.data.name}` : ''}. To activate your online account, please confirm your PAN and date of birth.
        </p>
        {error && <Alert type="error">{error}</Alert>}
        <Field label="PAN" hint="Format: AAAAA9999A" error={fe.pan} required>
          <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} autoComplete="off" autoCapitalize="characters" />
        </Field>
        <Field label="Date of birth" error={fe.dob} required>
          <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Button type="submit" block size="lg" loading={busy === 'verify'}>
          Continue
        </Button>
      </form>
    );
  else if (step === 'password')
    body = (
      <form onSubmit={complete} noValidate className="stack">
        <OtpStep challenge={challenge} otp={otp} setOtp={setOtp} onResend={resend} resending={busy === 'resend'} error={error} resendKey={resendKey} />
        <Field label="Create password" error={fe.newPassword} required>
          <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <PasswordChecklist password={pw} pan={pan} />
        <Field label="Confirm password" error={fe.confirm} required>
          <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button type="submit" block size="lg" loading={busy === 'complete'}>
          Activate account
        </Button>
      </form>
    );
  else
    body = (
      <div className="stack">
        <Alert type="success">Your account is active. You can now log in with your mobile number, email or PAN and your new password.</Alert>
        <Button to="/login" block size="lg">
          Go to login
        </Button>
      </div>
    );

  return (
    <AuthLayout>
      <div className="stack">
        <div>
          <span className="eyebrow">Account activation</span>
          <h1>Activate your account</h1>
          <span className="gold-rule gold-rule--dark" aria-hidden="true" />
        </div>
        {body}
      </div>
    </AuthLayout>
  );
}
