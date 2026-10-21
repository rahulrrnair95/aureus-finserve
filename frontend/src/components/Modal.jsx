import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focus trap + Escape + restore focus. */
export function useFocusTrap(open, ref, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector('[data-autofocus]') || el?.querySelector(FOCUSABLE);
    (first || el)?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      } else if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!items.length) {
          e.preventDefault();
          return;
        }
        const f = items[0];
        const l = items[items.length - 1];
        if (e.shiftKey && document.activeElement === f) {
          e.preventDefault();
          l.focus();
        } else if (!e.shiftKey && document.activeElement === l) {
          e.preventDefault();
          f.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      if (prev && prev.focus) prev.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/**
 * <Modal open title onClose footer wide>children</Modal>
 */
export default function Modal({ open, title, onClose, children, footer, wide = false, describedBy }) {
  const ref = useRef(null);
  const titleId = useId();
  useFocusTrap(open, ref, onClose);
  if (!open) return null;
  return createPortal(
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div ref={ref} className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={describedBy} tabIndex={-1}>
        <div className="modal__head">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Side drawer (right). */
export function Drawer({ open, title, onClose, children, footer }) {
  const ref = useRef(null);
  const titleId = useId();
  useFocusTrap(open, ref, onClose);
  if (!open) return null;
  return createPortal(
    <div
      className="overlay drawer-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal__head">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
