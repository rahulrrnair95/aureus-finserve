import { useId } from 'react';
import Button from '../../../components/Button';
import OtpInput from '../../../components/OtpInput';
import { DevOtp } from '../../../components/States';
import { useCountdown } from '../../../components/Misc';

/**
 * Step 2 of an OTP-verified public form.
 * Props: mobile, challengeId, devOtp, otp, setOtp, error, onSubmit, onResend, onBack, submitting, resending, submitLabel
 */
export default function OtpStep({ mobile, challengeId, devOtp, otp, setOtp, error, onSubmit, onResend, onBack, submitting, resending, submitLabel = 'Verify and submit' }) {
  const left = useCountdown(30, [challengeId]);
  const errId = useId();
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <p style={{ margin: 0 }}>
        We have sent a 6-digit OTP to <strong className="num">XXXXXX{String(mobile).slice(-4)}</strong>. It is valid for 5 minutes.
      </p>
      <DevOtp code={devOtp} />
      <OtpInput value={otp} onChange={setOtp} label="Enter the 6-digit OTP" invalid={!!error} describedBy={error ? errId : undefined} />
      {error && (
        <p id={errId} className="field__error" role="alert" style={{ margin: '0.5rem 0 0' }}>
          {error}
        </p>
      )}
      <div className="row">
        <Button type="submit" loading={submitting} disabled={otp.length !== 6}>
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onBack} disabled={submitting}>
          Edit details
        </Button>
      </div>
      <p className="small muted" style={{ margin: 0 }} aria-live="polite">
        {left > 0 ? (
          <>Didn’t receive it? You can resend in {left}s.</>
        ) : (
          <Button variant="link" onClick={onResend} loading={resending}>
            Resend OTP
          </Button>
        )}
      </p>
    </form>
  );
}
