// Small shared UI pieces for console pages.
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { copyText } from './common';

export function PageTitle({ eyebrow = 'Staff console', title, children }) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {children && <div className="row con-actions">{children}</div>}
    </div>
  );
}

/** Read-only value with a Copy button. `highlight` for one-time secrets. */
export function CopyField({ label, value, hint, highlight = false }) {
  const id = useId();
  const ref = useRef(null);
  const [copied, setCopied] = useState(null);
  const onCopy = async () => {
    const ok = await copyText(value);
    if (!ok) ref.current?.select();
    setCopied(ok ? 'Copied to clipboard.' : 'Copy failed — the text is selected, press Ctrl+C to copy.');
  };
  return (
    <div className={`field con-copy ${highlight ? 'con-copy--secret' : ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <div className="input-group">
        <input
          ref={ref}
          id={id}
          className="input con-copy__input"
          readOnly
          value={value || ''}
          onFocus={(e) => e.target.select()}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button type="button" className="input-group__btn" onClick={onCopy}>
          <Icon name="check" size={16} /> Copy
        </button>
      </div>
      {hint && (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      )}
      <span className="tiny con-copy__status" aria-live="polite">
        {copied}
      </span>
    </div>
  );
}

/** KPI tile; links when `to` given. */
export function Kpi({ label, value, sub, to, icon }) {
  const inner = (
    <div className="stat">
      <span className="stat__label">
        {icon && <Icon name={icon} size={16} />} {label}
      </span>
      <span className="stat__value num">{value}</span>
      {sub && <span className="stat__sub">{sub}</span>}
    </div>
  );
  if (to) {
    return (
      <Link to={to} className="card con-kpi con-kpi--link">
        {inner}
        <span className="sr-only"> — view</span>
      </Link>
    );
  }
  return <div className="card con-kpi">{inner}</div>;
}

/** Definition list of label/value pairs. */
export function DetailList({ items }) {
  return (
    <dl className="con-dl">
      {items.map(([k, v]) => (
        <div key={k} className="con-dl__row">
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === '' ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Button that doesn't trigger row clicks. */
export function RowButton({ onClick, ...props }) {
  return (
    <Button
      size="sm"
      {...props}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}
