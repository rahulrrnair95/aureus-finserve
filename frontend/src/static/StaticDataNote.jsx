import { useEffect, useState } from 'react';
import { formatDate } from '../utils/format';

/** Static site only: when the fund data snapshot was taken (NAVs are not live). */
export default function StaticDataNote() {
  const [at, setAt] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('/static-api/meta.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => alive && m?.generatedAt && setAt(m.generatedAt))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!at) return null;
  return (
    <p className="tiny" style={{ opacity: 0.75 }}>
      Fund data as of {formatDate(at.slice(0, 10))}.
    </p>
  );
}
