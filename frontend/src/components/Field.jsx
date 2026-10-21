import { cloneElement, isValidElement, useId, useState } from 'react';

/**
 * <Field label="Name" error={err} hint="..." required>
 *   <Input value=... onChange=... />
 * </Field>
 * Field wires id / aria-describedby / aria-invalid into its single child control.
 */
export function Field({ label, hint, error, required, children, className = '', labelHidden = false }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const child = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? 'true' : undefined,
        required: required || children.props.required,
      })
    : children;
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={(isValidElement(children) && children.props.id) || id} className={labelHidden ? 'sr-only' : 'field__label'}>
          {label}
          {required && (
            <span className="field__req" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {child}
      {hint && (
        <span id={hintId} className="field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`input ${className}`} {...props} />;
}

export function Select({ className = '', options, placeholder, children, ...props }) {
  return (
    <select className={`select ${className}`} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options
        ? options.map((o) => {
            const opt = typeof o === 'object' ? o : { value: o, label: o };
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })
        : children}
    </select>
  );
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`textarea ${className}`} {...props} />;
}

export function Checkbox({ label, className = '', ...props }) {
  return (
    <label className={`check ${className}`}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Password input with show/hide toggle. Pass through to <Field>. */
export function PasswordInput({ id, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-group">
      <input id={id} className="input" type={show ? 'text' : 'password'} autoComplete="current-password" {...props} />
      <button type="button" className="input-group__btn" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

/** ₹ prefixed money input */
export function MoneyInput({ id, className = '', ...props }) {
  return (
    <div className="input-group">
      <span className="input-prefix" aria-hidden="true">
        ₹
      </span>
      <input id={id} className={`input input--prefixed ${className}`} type="number" inputMode="decimal" min="0" {...props} />
    </div>
  );
}

/** Slider + number input pair. */
export function SliderField({ label, value, onChange, min, max, step = 1, format = (v) => v, suffix, prefix }) {
  const id = useId();
  return (
    <div className="slider-field">
      <div className="slider-field__top">
        <label htmlFor={`${id}-n`} className="field__label">
          {label}
        </label>
        <div className="row" style={{ gap: '0.35rem', flexWrap: 'nowrap' }}>
          {prefix && <span className="muted" aria-hidden="true">{prefix}</span>}
          <input
            id={`${id}-n`}
            className="input"
            type="number"
            inputMode="decimal"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            onBlur={() => {
              const n = Number(value);
              if (Number.isNaN(n) || value === '') onChange(min);
              else onChange(Math.min(max, Math.max(min, n)));
            }}
          />
          {suffix && <span className="muted small" aria-hidden="true">{suffix}</span>}
        </div>
      </div>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(value) || min}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} slider`}
        aria-valuetext={String(format(value))}
      />
      <div className="row row--between tiny muted">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
