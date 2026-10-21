import { useEffect, useRef } from 'react';

/**
 * 6-box OTP input, paste-friendly, auto-advance, backspace navigation.
 * <OtpInput value={otp} onChange={setOtp} label="Enter the 6-digit OTP" onComplete={(v)=>...} />
 */
export default function OtpInput({ value = '', onChange, length = 6, label = 'One-time password', onComplete, autoFocus = true, invalid, describedBy }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const set = (next) => {
    const v = next.replace(/\D/g, '').slice(0, length);
    onChange(v);
    if (v.length === length) onComplete?.(v);
  };

  const onInput = (i, e) => {
    const ch = e.target.value.replace(/\D/g, '');
    if (!ch) return;
    if (ch.length > 1) {
      // Autofill / paste into one box
      set(ch);
      refs.current[Math.min(ch.length, length) - 1]?.focus();
      return;
    }
    const arr = digits.slice();
    arr[i] = ch;
    set(arr.join(''));
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = digits.slice();
      if (arr[i]) {
        arr[i] = '';
        onChange(arr.join('').slice(0, length));
      } else if (i > 0) {
        arr[i - 1] = '';
        onChange(arr.join(''));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (e) => {
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
    if (!text) return;
    e.preventDefault();
    set(text);
    refs.current[Math.min(text.length, length) - 1]?.focus();
  };

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="field__label" style={{ marginBottom: '0.5rem' }}>
        {label}
      </legend>
      <div className="otp" onPaste={onPaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            maxLength={i === 0 ? length : 1}
            value={d}
            aria-label={`Digit ${i + 1} of ${length}`}
            aria-invalid={invalid ? 'true' : undefined}
            aria-describedby={describedBy}
            onChange={(e) => onInput(i, e)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </fieldset>
  );
}
