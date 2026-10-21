import { useState } from 'react';
import Button from '../../components/Button';
import { Field, PasswordInput } from '../../components/Field';
import { Alert } from '../../components/States';
import { useToast } from '../../components/Toast';
import { authApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { passwordValid } from '../../utils/password';
import { OtpStep, PasswordChecklist } from './parts';

/** Change password (current + new + OTP). Self-contained; used in investor and console settings. */
export default function ChangePasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState('');
  const [fe, setFe] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [resendKey, setResendKey] = useState(0);

  const reset = () => {
    setCurrent('');
    setPw('');
    setPw2('');
    setChallenge(null);
    setOtp('');
    setFe({});
    setError(null);
  };

  const requestOtp = async (e) => {
    e.preventDefault();
    setError(null);
    const f = {};
    if (!current) f.currentPassword = 'Enter your current password.';
    if (!passwordValid(pw)) f.newPassword = 'Your new password does not meet all the requirements.';
    if (pw && pw === current) f.newPassword = 'The new password must be different from the current one.';
    if (pw !== pw2) f.confirm = 'Passwords do not match.';
    setFe(f);
    if (Object.keys(f).length) return;
    setBusy('otp');
    try {
      const res = await authApi.changePasswordOtp();
      setChallenge(res);
      setOtp('');
      setResendKey((k) => k + 1);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    setBusy('resend');
    try {
      const res = await authApi.changePasswordOtp();
      setChallenge(res);
      setOtp('');
      setResendKey((k) => k + 1);
      setError(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setBusy('submit');
    setError(null);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: pw, challengeId: challenge.challengeId, otp });
      toast.success('Your password has been changed.');
      reset();
    } catch (err) {
      if (err.fields) setFe(err.fields);
      setError(friendlyError(err));
      if (err.code === 'INVALID_CREDENTIALS' || err.code === 'VALIDATION') setChallenge(null);
      setOtp('');
    } finally {
      setBusy(null);
    }
  };

  if (challenge) {
    return (
      <form onSubmit={submit} noValidate className="stack">
        <OtpStep challenge={challenge} otp={otp} setOtp={setOtp} onResend={resend} resending={busy === 'resend'} error={error} resendKey={resendKey} />
        <div className="row">
          <Button type="submit" loading={busy === 'submit'} disabled={otp.length !== 6}>
            Change password
          </Button>
          <Button variant="ghost" onClick={() => setChallenge(null)}>
            Back
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={requestOtp} noValidate className="stack" style={{ maxWidth: 460 }}>
      {error && <Alert type="error">{error}</Alert>}
      <Field label="Current password" error={fe.currentPassword} required>
        <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field label="New password" error={fe.newPassword} required>
        <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
      </Field>
      <PasswordChecklist password={pw} />
      <Field label="Confirm new password" error={fe.confirm} required>
        <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
      </Field>
      <div>
        <Button type="submit" loading={busy === 'otp'}>
          Send OTP to continue
        </Button>
      </div>
    </form>
  );
}
