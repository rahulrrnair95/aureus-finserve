import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Button from '../../components/Button';
import { Field, Input, PasswordInput } from '../../components/Field';
import { Alert } from '../../components/States';
import { authApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { detectUserIdType, passwordValid } from '../../utils/password';
import { useTitle } from '../../utils/useTitle';
import { OtpStep, PasswordChecklist } from './parts';

export default function ForgotPassword() {
  useTitle('Reset password');
  const [params] = useSearchParams();
  const [step, setStep] = useState('id');
  const [userId, setUserId] = useState(params.get('userId') || '');
  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [fe, setFe] = useState({});
  const [resendKey, setResendKey] = useState(0);

  const ctx = /^\d{10}$/.test(userId.trim()) ? { mobile: userId.trim() } : /^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(userId.trim()) ? { pan: userId.trim() } : {};

  const requestOtp = async (e) => {
    e.preventDefault();
    setError(null);
    if (!userId.trim()) {
      setFe({ userId: 'Please enter your mobile number, email or PAN.' });
      return;
    }
    setFe({});
    setBusy('req');
    try {
      const res = await authApi.forgot(userId.trim());
      setChallenge(res);
      setResendKey((k) => k + 1);
      setStep('reset');
    } catch (err) {
      setError(friendlyError(err));
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

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const f = {};
    if (otp.length !== 6) f.otp = 'Enter the 6-digit OTP.';
    if (!passwordValid(pw, ctx)) f.newPassword = 'Your new password does not meet all the requirements.';
    if (pw !== pw2) f.confirm = 'Passwords do not match.';
    setFe(f);
    if (Object.keys(f).length) {
      if (f.otp) setError(f.otp);
      return;
    }
    setBusy('reset');
    try {
      await authApi.reset({ challengeId: challenge.challengeId, otp, newPassword: pw });
      setStep('done');
    } catch (err) {
      if (err.fields) setFe(err.fields);
      setError(friendlyError(err));
      if (err.code?.startsWith('OTP_')) setOtp('');
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthLayout>
      <div className="stack">
        <div>
          <span className="eyebrow">Account recovery</span>
          <h1>{step === 'done' ? 'Password updated' : 'Reset your password'}</h1>
          <span className="gold-rule gold-rule--dark" aria-hidden="true" />
        </div>

        {step === 'id' && (
          <form onSubmit={requestOtp} noValidate className="stack">
            <p className="muted">Enter your registered mobile number, email or PAN. If an account exists, we will send an OTP to the registered mobile number and email.</p>
            {error && <Alert type="error">{error}</Alert>}
            <Field label="User ID" hint={detectUserIdType(userId)} error={fe.userId} required>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} autoComplete="username" autoCapitalize="none" />
            </Field>
            <Button type="submit" block size="lg" loading={busy === 'req'}>
              Send OTP
            </Button>
            <Link to="/login" className="small">
              ← Back to login
            </Link>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={submit} noValidate className="stack">
            <OtpStep challenge={challenge} otp={otp} setOtp={setOtp} onResend={resend} resending={busy === 'resend'} error={error} resendKey={resendKey} />
            <Field label="New password" error={fe.newPassword} required>
              <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            </Field>
            <PasswordChecklist password={pw} {...ctx} />
            <Field label="Confirm new password" error={fe.confirm} required>
              <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </Field>
            <Button type="submit" block size="lg" loading={busy === 'reset'}>
              Update password
            </Button>
            <p className="tiny muted">For your security, resetting your password signs you out of all other devices.</p>
          </form>
        )}

        {step === 'done' && (
          <div className="stack">
            <Alert type="success">Your password has been updated. All other sessions have been signed out.</Alert>
            <Button to="/login" block size="lg">
              Continue to login
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
