import { useEffect, useState } from 'react';
import { formatDate } from '../utils/format';
import { loadNavOverlay } from './staticApi';

/** Static site only: when the fund data snapshot was taken, and the date of the daily NAVs when they are newer. */
export default function StaticDataNote() {
  const [at, setAt] = useState(null);
  const [navAt, setNavAt] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('/static-api/meta.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => alive && m?.generatedAt && setAt(m.generatedAt))
      .catch(() => {});
    loadNavOverlay().then((o) => alive && o?.asOf && setNavAt(o.asOf));
    return () => {
      alive = false;
    };
  }, []);
  if (!at) return null;
  const day = at.slice(0, 10);
  return (
    <p className="tiny" style={{ opacity: 0.75 }}>
      Fund data as of {formatDate(day)}.{navAt && navAt > day && ` NAVs and returns as of ${formatDate(navAt)}.`}
    </p>
  );
}
