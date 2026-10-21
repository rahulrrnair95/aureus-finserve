import { useId } from 'react';
import Icon from '../../components/Icon';
import OtpInput from '../../components/OtpInput';
import Button from '../../components/Button';
import { Alert, DevOtp } from '../../components/States';
import { useCountdown } from '../../components/Misc';
import { passwordChecks } from '../../utils/password';

/** Live password policy checklist. */
export function PasswordChecklist({ password, pan, mobile, id }) {
  const checks = passwordChecks(password, { pan, mobile });
  return (
    <ul className="checklist" id={id} aria-label="Password requirements">
      {checks.map((c) => (
        <li key={c.key} className={c.ok ? 'ok' : undefined}>
          <Icon name={c.ok ? 'check' : 'close'} size={14} strokeWidth={2.2} />
          <span>
            {c.label}
            <span className="sr-only">{c.ok ? ' — met' : ' — not met'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * OTP step: masked destinations, 6-box input, resend with countdown, dev OTP hint.
 * challenge: { challengeId, maskedMobile, maskedEmail, devOtp }
 */
export function OtpStep({ challenge, otp, setOtp, onResend, resending, error, attemptsNote, resendKey, label = 'Enter the 6-digit OTP' }) {
  const left = useCountdown(30, [resendKey]);
  const descId = useId();
  const dest = [challenge?.maskedMobile, challenge?.maskedEmail].filter(Boolean);
  return (
    <div className="stack">
      <p id={descId} className="muted small" style={{ margin: 0 }}>
        {dest.length ? (
          <>
            We have sent a one-time password to <strong>{dest.join(' and ')}</strong>. It is valid for 5 minutes.
          </>
        ) : (
          'We have sent a one-time password to your registered mobile number and email. It is valid for 5 minutes.'
        )}
      </p>
      <OtpInput value={otp} onChange={setOtp} label={label} invalid={!!error} describedBy={descId} />
      <DevOtp code={challenge?.devOtp} />
      {error && <Alert type="error">{error}</Alert>}
      {attemptsNote && !error && <p className="small muted">{attemptsNote}</p>}
      <div className="row small">
        <span className="muted">Didn’t receive it?</span>
        {left > 0 ? (
          <span className="muted" aria-live="polite">
            Resend in {left}s
          </span>
        ) : (
          <Button variant="link" onClick={onResend} disabled={resending}>
            {resending ? 'Sending…' : 'Resend OTP'}
          </Button>
        )}
      </div>
    </div>
  );
}
