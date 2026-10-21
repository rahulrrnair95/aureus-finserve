import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useApi(fn, deps) — runs fn() on mount / when deps change.
 * Returns { data, error, loading, reload, setData }.
 * fn may return a promise; errors are ApiError instances.
 */
export function useApi(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: enabled });
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve()
      .then(() => fnRef.current())
      .then(
        (data) => {
          if (id === seq.current) setState({ data, error: null, loading: false });
          return data;
        },
        (error) => {
          if (id === seq.current) setState((s) => ({ data: s.data, error, loading: false }));
        },
      );
  }, []);

  useEffect(() => {
    if (enabled) run();
    else setState((s) => ({ ...s, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}
