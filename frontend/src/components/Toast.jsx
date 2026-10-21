import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message, type = 'info', ms = 5000) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { id, message, type }]);
      if (ms) setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast, success: (m) => toast(m, 'success'), error: (m) => toast(m, 'error', 8000) }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <div style={{ flex: 1 }}>{t.message}</div>
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
