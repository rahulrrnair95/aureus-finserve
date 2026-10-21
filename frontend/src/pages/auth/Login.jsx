import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Button from '../../components/Button';
import { Field, Input, PasswordInput, Checkbox } from '../../components/Field';
import { Alert } from '../../components/States';
import { authApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { homeForRole, takeFlash, useAuth } from '../../auth/AuthContext';
import { detectUserIdType } from '../../utils/password';
import { useTitle } from '../../utils/useTitle';
import { OtpStep } from './parts';

const OTP_MAX_ATTEMPTS = 3;

export default function Login() {
  useTitle('Log in');
  const { user, ready, signIn } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [flash] = useState(() => takeFlash());

  const [step, setStep] = useState('credentials');
  const [userId, setUserId] = useState(() => loc.state?.demo?.userId || '');
  const [password, setPassword] = useState(() => loc.state?.demo?.password || '');
  const [remember, setRemember] = useState(false);
  // demo preview: "Log in as" fills the form
  useEffect(() => {
    if (loc.state?.demo) {
      setUserId(loc.state.demo.userId);
      setPassword(loc.state.demo.password);
    }
  }, [loc.state]);
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'login' | 'otp-only' | 'verify' | 'resend'

  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [resendKey, setResendKey] = useState(0);

  useEffect(() => {
    document.getElementById('main')?.focus();
  }, [step]);

  if (ready && user) return <Navigate to={homeForRole(user.role)} replace />;

  const finish = (token, u) => {
    signIn(token, u);
    const from = loc.state?.from;
    const home = homeForRole(u.role);
    const allowed = from && ((u.role === 'INVESTOR' && from.startsWith('/app')) || (u.role !== 'INVESTOR' && from.startsWith('/console')));
    navigate(allowed ? from : home, { replace: true });
  };

  const loadCaptcha = async () => {
    try {
      const c = await authApi.captcha();
      setCaptcha(c);
      setCaptchaAnswer('');
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const handleLoginResult = (res) => {
    if (res?.status === 'OK' && res.token) {
      finish(res.token, res.user);
      return;
    }
    setChallenge(res);
    setOtp('');
    setOtpError(null);
    setAttempts(0);
    setResendKey((k) => k + 1);
    setStep('otp');
  };

  const validate = (needPassword) => {
    const fe = {};
    if (!userId.trim()) fe.userId = 'Please enter your mobile number, email or PAN.';
    if (needPassword && !password) fe.password = 'Please enter your password.';
    if (needPassword && captcha && !captchaAnswer.trim()) fe.captchaAnswer = 'Please answer the security question.';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  };

  const onLogin = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validate(true)) return;
    setBusy('login');
    try {
      const body = { userId: userId.trim(), password };
      if (captcha) {
        body.captchaId = captcha.captchaId;
        body.captchaAnswer = captchaAnswer.trim();
      }
      const res = await authApi.login(body);
      setCaptcha(null);
      handleLoginResult(res);
    } catch (err) {
      if (err.code === 'CAPTCHA_REQUIRED' || err.code === 'CAPTCHA_INVALID') {
        await loadCaptcha();
      } else if (captcha) {
        // captcha is single-use; refresh it for the next attempt
        await loadCaptcha();
      }
      if (err.fields) setFieldErrors(err.fields);
      setError(err);
      setPassword('');
    } finally {
      setBusy(null);
    }
  };

  const onOtpOnly = async () => {
    setError(null);
    if (!validate(false)) return;
    setBusy('otp-only');
    try {
      const res = await authApi.loginOtp(userId.trim());
      handleLoginResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const onVerify = async (e) => {
    e?.preventDefault();
    if (otp.length !== 6) {
      setOtpError('Please enter all 6 digits.');
      return;
    }
    setBusy('verify');
    setOtpError(null);
    try {
      const res = await authApi.verifyOtp({ challengeId: challenge.challengeId, otp, rememberDevice: remember });
      finish(res.token, res.user);
    } catch (err) {
      const n = attempts + 1;
      setAttempts(n);
      setOtp('');
      if (err.code === 'OTP_INVALID') {
        const left = OTP_MAX_ATTEMPTS - n;
        setOtpError(left > 0 ? `The OTP is incorrect. ${left} attempt${left === 1 ? '' : 's'} left.` : 'The OTP is incorrect. Please request a new OTP.');
      } else setOtpError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const onResend = async () => {
    setBusy('resend');
    setOtpError(null);
    try {
      const res = await authApi.resendOtp(challenge.challengeId);
      setChallenge((c) => ({ ...c, ...res }));
      setAttempts(0);
      setOtp('');
      setResendKey((k) => k + 1);
    } catch (err) {
      setOtpError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const errBox = error && (
    <Alert type={error.code === 'ACCOUNT_LOCKED' || error.code === 'ACCOUNT_DISABLED' ? 'warning' : 'error'} title={error.code === 'ACCOUNT_LOCKED' ? 'Account temporarily locked' : undefined}>
      {friendlyError(error)}
      {error.code === 'ACCOUNT_LOCKED' && (
        <>
          {' '}
          You can also <Link to={`/forgot-password?userId=${encodeURIComponent(userId)}`}>reset your password</Link>.
        </>
      )}
    </Alert>
  );

  return (
    <AuthLayout>
      {step === 'credentials' ? (
        <form onSubmit={onLogin} noValidate className="stack">
          <div>
            <span className="eyebrow">Secure client &amp; staff login</span>
            <h1>Welcome back</h1>
            <span className="gold-rule gold-rule--dark" aria-hidden="true" />
          </div>
          {flash && <Alert type="info">{flash}</Alert>}
          {errBox}
          <Field label="User ID" hint={detectUserIdType(userId)} error={fieldErrors.userId} required>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} autoComplete="username" placeholder="Mobile, email or PAN" autoCapitalize="none" spellCheck="false" />
          </Field>
          <Field label="Password" error={fieldErrors.password} required>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {captcha && (
            <Field label={`Security question: ${captcha.question}`} error={fieldErrors.captchaAnswer} hint="This helps us keep your account safe after several unsuccessful attempts." required>
              <Input value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} inputMode="numeric" autoComplete="off" />
            </Field>
          )}
          <Checkbox label="Remember this device for 30 days (skip OTP on this device — investors only)" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Button type="submit" block size="lg" loading={busy === 'login'}>
            Log in
          </Button>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Button variant="outline" onClick={onOtpOnly} loading={busy === 'otp-only'}>
              Log in with OTP only
            </Button>
            <Button variant="link" to={`/forgot-password${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`}>
              Forgot password?
            </Button>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>
            OTP-only login is available to investors. Staff accounts always require password and OTP.
          </p>
        </form>
      ) : (
        <form onSubmit={onVerify} noValidate className="stack">
          <div>
            <span className="eyebrow">Two-step verification</span>
            <h1>Verify it’s you</h1>
            <span className="gold-rule gold-rule--dark" aria-hidden="true" />
          </div>
          <OtpStep
            challenge={challenge}
            otp={otp}
            setOtp={setOtp}
            onResend={onResend}
            resending={busy === 'resend'}
            error={otpError}
            resendKey={resendKey}
            attemptsNote={`You have up to ${OTP_MAX_ATTEMPTS} attempts for each OTP.`}
          />
          <Checkbox label="Remember this device for 30 days" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Button type="submit" block size="lg" loading={busy === 'verify'} disabled={otp.length !== 6}>
            Verify &amp; continue
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setStep('credentials');
              setChallenge(null);
            }}
          >
            ← Use a different account
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
