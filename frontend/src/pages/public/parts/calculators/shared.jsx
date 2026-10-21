import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Button from '../../../../components/Button';
import { useToast } from '../../../../components/Toast';
import { AXIS_TICK, CHART_GRID, ChartTooltip, Legend, compactAxis } from '../../../../components/Charts';
import { useAuth } from '../../../../auth/AuthContext';
import { useSite } from '../../../../auth/SiteContext';
import { CALC_DISCLAIMER, downloadCalculatorPdf } from '../../../../utils/pdf';
import { formatINR, formatLakhCrore } from '../../../../utils/format';
import { STATIC_SITE } from '../../../../utils/siteMode';

export const inr = (v) => formatINR(v, { decimals: 0 });
export const lc = (v) => formatLakhCrore(v);

/** Common ranges (section 6): return 1–30% p.a., period 1–40 years. */
export const RATE = { min: 1, max: 30, step: 0.5 };
export const YEARS = { min: 1, max: 40, step: 1 };

function clamp(v, f) {
  const n = Number(v);
  if (v === '' || v === null || Number.isNaN(n)) return f.def;
  return Math.min(f.max, Math.max(f.min, n));
}

/**
 * Calculator state, optionally synced to URL query params (history replace, debounced).
 * fields: { key: { def, min, max } | { def, options:[...] } }
 * Returns { values (raw, for inputs), n (validated numbers / option strings), set(key)(v), query (URLSearchParams string) }
 */
export function useCalcState(fields, sync) {
  const [sp, setSp] = useSearchParams();
  const [values, setValues] = useState(() => {
    const o = {};
    Object.entries(fields).forEach(([k, f]) => {
      const raw = sync ? sp.get(k) : null;
      if (f.options) o[k] = raw && f.options.includes(raw) ? raw : f.def;
      else o[k] = raw !== null && raw !== '' && !Number.isNaN(Number(raw)) ? clamp(raw, f) : f.def;
    });
    return o;
  });

  const n = useMemo(() => {
    const o = {};
    Object.entries(fields).forEach(([k, f]) => {
      o[k] = f.options ? values[k] : clamp(values[k], f);
    });
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    Object.entries(n).forEach(([k, v]) => q.set(k, String(v)));
    return q.toString();
  }, [n]);

  const spRef = useRef(sp);
  spRef.current = sp;
  useEffect(() => {
    if (!sync) return undefined;
    const t = setTimeout(() => {
      const next = new URLSearchParams(spRef.current);
      Object.entries(n).forEach(([k, v]) => next.set(k, String(v)));
      if (next.toString() !== spRef.current.toString()) setSp(next, { replace: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sync]);

  const set = (k) => (v) => setValues((s) => ({ ...s, [k]: v }));
  return { values, n, set, query };
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function ResultStats({ items }) {
  return (
    <dl className="pub-calc__stats">
      {items.map((it) => (
        <div key={it.label} className={`pub-calc__stat ${it.accent ? 'pub-calc__stat--accent' : ''}`}>
          <dt>{it.label}</dt>
          <dd className="num">{it.value}</dd>
          {it.sub && <dd className="pub-calc__sub">{it.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

/**
 * Year-wise growth chart. series: [{ key, name, color, type: 'area'|'line', dashed }]
 */
export function GrowthChart({ data, series, label, xKey = 'year' }) {
  return (
    <figure className="pub-calc__chart">
      <div className="chart" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {series
                .filter((s) => s.type !== 'line')
                .map((s) => (
                  <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.04} />
                  </linearGradient>
                ))}
            </defs>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART_GRID }} tickFormatter={(v) => `Yr ${v}`} minTickGap={16} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={compactAxis} width={64} />
            <Tooltip content={<ChartTooltip labelFormatter={(v) => `Year ${v}`} />} />
            {series.map((s) =>
              s.type === 'line' ? (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '6 4' : undefined} dot={false} isAnimationActive={false} />
              ) : (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} isAnimationActive={false} />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
    </figure>
  );
}

/** Calls-to-action shown after every calculator. */
export function CalcCtas() {
  const { user } = useAuth();
  const investTo = STATIC_SITE ? `/contact?message=${encodeURIComponent("I'd like to start investing in mutual funds.")}` : user?.role === 'INVESTOR' ? '/app/transact' : user ? '/console/orders' : '/login';
  return (
    <div className="row pub-calc__ctas">
      <Button to={investTo} state={!user && !STATIC_SITE ? { from: '/app/transact' } : undefined}>
        Invest now
      </Button>
      <Button variant="outline" to="/contact">
        Talk to an expert
      </Button>
    </div>
  );
}

/**
 * Layout for one calculator: inputs | results (+chart, summary, extra, actions, disclaimer, CTAs).
 */
export function CalcShell({ id, title, headingLevel = 2, inputs, stats, chart, summary, extra, pdf, query, note }) {
  const toast = useToast();
  const { site } = useSite();
  const [busy, setBusy] = useState(false);
  const H = `h${headingLevel}`;
  const shareUrl = `${window.location.origin}/calculators/${id}?${query}`;

  const onCopy = async () => {
    const ok = await copyText(shareUrl);
    if (ok) toast.success('Link copied. Anyone with the link will see these inputs.');
    else toast.error(`Couldn’t copy automatically. Link: ${shareUrl}`);
  };
  const onPdf = async () => {
    setBusy(true);
    try {
      await downloadCalculatorPdf({ title, inputs: pdf.inputs, results: pdf.results, notes: pdf.notes || [], site, url: shareUrl, fileName: `${id}-calculation.pdf` });
    } catch {
      toast.error('The PDF could not be created. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pub-calc" aria-label={title}>
      <div className="pub-calc__grid">
        <form className="pub-calc__inputs card" onSubmit={(e) => e.preventDefault()} aria-label={`${title} inputs`}>
          <H className="pub-calc__title">{title}</H>
          <div className="stack-lg">{inputs}</div>
          {note && <p className="tiny muted" style={{ marginTop: '1.25rem' }}>{note}</p>}
        </form>
        <div className="pub-calc__results card">
          <ResultStats items={stats} />
          {chart}
          <p className="small pub-calc__summary">{summary}</p>
          {extra}
          <div className="row pub-calc__actions">
            <Button variant="ghost" size="sm" onClick={onCopy}>
              Copy link
            </Button>
            <Button variant="ghost" size="sm" onClick={onPdf} loading={busy}>
              Download PDF
            </Button>
          </div>
          <p className="disclaimer-box tiny" style={{ margin: '1rem 0 0' }}>
            {CALC_DISCLAIMER}
          </p>
          <CalcCtas />
        </div>
      </div>
    </section>
  );
}
