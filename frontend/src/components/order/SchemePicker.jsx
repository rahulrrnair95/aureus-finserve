import { useEffect, useId, useState } from 'react';
import { publicApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { formatINR, formatNav, formatDate } from '../../utils/format';
import { RiskBadge } from '../RiskOMeter';
import Button from '../Button';

/**
 * Searchable scheme picker using the public schemes API.
 * <SchemePicker label value={scheme|null} onChange={(scheme|null)=>} amc="restrict to AMC" excludeId />
 */
export default function SchemePicker({ label = 'Scheme', value, onChange, amc, excludeId, error }) {
  const id = useId();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (value) return undefined;
    const t = setTimeout(() => {
      setLoading(true);
      setErr(null);
      publicApi
        .schemes({ q: q.trim() || undefined, amc: amc || undefined, size: 8, page: 0, sort: q.trim() ? 'name' : 'aum' })
        .then((r) => setResults((r?.items || []).filter((s) => String(s.id) !== String(excludeId))))
        .catch((e) => setErr(friendlyError(e)))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, amc, excludeId, value]);

  if (value) {
    return (
      <div className="field">
        <span className="field__label">{label}</span>
        <div className="picked">
          <div style={{ minWidth: 0 }}>
            <div className="picked__name">{value.name}</div>
            <div className="small muted">
              {value.amc} · {value.subCategory || value.category} · NAV {formatNav(value.nav)} ({formatDate(value.navDate)})
            </div>
            <div className="row small" style={{ marginTop: 4 }}>
              <RiskBadge risk={value.risk} />
              {value.minLumpsum != null && <span className="muted">Min lump sum {formatINR(value.minLumpsum, { decimals: 0 })}</span>}
              {value.minSip != null && <span className="muted">Min SIP {formatINR(value.minSip, { decimals: 0 })}</span>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Change<span className="sr-only"> scheme</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
        {amc && <span className="muted small"> — {amc} schemes only</span>}
      </label>
      <input
        id={id}
        className="input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by scheme name"
        aria-describedby={`${id}-status`}
        aria-invalid={error ? 'true' : undefined}
        autoComplete="off"
      />
      <span id={`${id}-status`} className="sr-only" aria-live="polite">
        {loading ? 'Searching' : `${results.length} schemes found`}
      </span>
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
      {err && <span className="field__error">{err}</span>}
      <ul className="picker-list" aria-label="Matching schemes">
        {loading && !results.length && <li className="small muted" style={{ padding: '0.75rem' }}>Searching…</li>}
        {!loading && !results.length && !err && <li className="small muted" style={{ padding: '0.75rem' }}>No schemes match your search.</li>}
        {results.map((s) => (
          <li key={s.id}>
            <button type="button" className="picker-item" onClick={() => onChange(s)}>
              <span className="picker-item__name">{s.name}</span>
              <span className="small muted">
                {s.amc} · {s.subCategory || s.category}
              </span>
              <RiskBadge risk={s.risk} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
