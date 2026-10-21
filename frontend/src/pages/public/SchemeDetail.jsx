import { Link, useParams } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Button from '../../components/Button';
import { ExtLink, StandardDisclaimer } from '../../components/Misc';
import { Pct } from '../../components/Money';
import RiskOMeter from '../../components/RiskOMeter';
import { ErrorState } from '../../components/States';
import { SkeletonBlock, SkeletonCards } from '../../components/Skeleton';
import { AXIS_TICK, CHART_GOLD, CHART_GRID, CHART_NAVY, ChartTooltip } from '../../components/Charts';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useAuth } from '../../auth/AuthContext';
import { useTitle } from '../../utils/useTitle';
import { formatCr, formatDate, formatINR, formatMonth, formatNav, formatPct, humanize } from '../../utils/format';
import NotFoundBlock from './parts/NotFoundBlock';
import { STATIC_SITE } from '../../utils/siteMode';

function InvestButton({ id, name }) {
  const { user } = useAuth();
  const target = `/app/transact?scheme=${id}`;
  if (STATIC_SITE) {
    return (
      <Button variant="gold" size="lg" to={`/contact?message=${encodeURIComponent(`I'd like to invest in ${name || 'this scheme'}.`)}`}>
        Invest
      </Button>
    );
  }
  if (user?.role === 'INVESTOR') {
    return (
      <Button variant="gold" size="lg" to={target}>
        Invest
      </Button>
    );
  }
  if (user) {
    return (
      <Button variant="outline-gold" size="lg" to="/console/orders">
        Place order for a client
      </Button>
    );
  }
  return (
    <Button variant="gold" size="lg" to="/login" state={{ from: target }}>
      Log in to invest
    </Button>
  );
}

function NavChart({ s }) {
  const hist = s.navHistory || [];
  if (hist.length < 2) return <p className="small muted">NAV history is not available for this scheme yet.</p>;
  const first = hist[0];
  const last = hist[hist.length - 1];
  const change = ((last.nav - first.nav) / first.nav) * 100;
  const label = `NAV history from ${formatDate(first.date)} to ${formatDate(last.date)}: from ₹${formatNav(first.nav)} to ₹${formatNav(last.nav)}, a change of ${formatPct(change, { signed: true })}.`;
  return (
    <>
      <div className="chart chart--lg" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={hist} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="navFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_GOLD} stopOpacity={0.38} />
                <stop offset="100%" stopColor={CHART_NAVY} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={formatMonth} tickLine={false} axisLine={{ stroke: CHART_GRID }} minTickGap={28} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={60} tickFormatter={(v) => `₹${Math.round(v)}`} />
            <Tooltip content={<ChartTooltip labelFormatter={formatDate} valueFormatter={(v) => `₹${formatNav(v)}`} />} />
            <Area type="monotone" dataKey="nav" name="NAV" stroke={CHART_NAVY} strokeWidth={2} fill="url(#navFill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="small muted" style={{ marginTop: '0.75rem' }}>
        {label}
      </p>
    </>
  );
}

export default function SchemeDetail() {
  const { id } = useParams();
  const q = useApi(() => publicApi.scheme(id), [id]);
  const s = q.data;
  useTitle(s?.name || 'Scheme');

  if (q.error && (q.error.status === 404 || q.error.code === 'NOT_FOUND')) {
    return <NotFoundBlock title="Scheme not found" message="This scheme may have been merged or is no longer available. Explore other schemes in the fund explorer." backTo="/funds" backLabel="Fund explorer" />;
  }
  if (q.error && !s) {
    return (
      <section className="section">
        <div className="container">
          <ErrorState error={q.error} onRetry={q.reload} />
        </div>
      </section>
    );
  }
  if (!s) {
    return (
      <>
        <header className="page-head on-navy">
          <div className="container">
            <SkeletonBlock rows={3} height={24} />
          </div>
        </header>
        <section className="section">
          <div className="container stack-lg">
            <SkeletonCards count={3} />
            <SkeletonBlock rows={8} />
          </div>
        </section>
      </>
    );
  }

  const facts = [
    ['Expense ratio (Regular plan TER)', s.expenseRatio == null ? '—' : formatPct(s.expenseRatio)],
    ['Fund manager', s.fundManager || '—'],
    ['Benchmark', s.benchmark || '—'],
    ['Launch date', formatDate(s.launchDate)],
    ['Minimum SIP', formatINR(s.minSip, { decimals: 0 })],
    ['Minimum lump sum', formatINR(s.minLumpsum, { decimals: 0 })],
    ['Fund size (AUM, all plans)', formatCr(s.aumCr)],
    ['Scheme code', s.code || '—'],
    ['Exit load', s.exitLoad || '—', true], // long text: full-width row
  ];

  return (
    <>
      <header className="page-head on-navy pub-scheme-head">
        <div className="container">
          <nav aria-label="Breadcrumb" className="pub-crumbs tiny">
            <Link to="/funds">Fund explorer</Link> <span aria-hidden="true">/</span> <span aria-current="page">{s.amc}</span>
          </nav>
          <div className="pub-scheme-head__grid">
            <div>
              <span className="eyebrow">{s.amc}</span>
              <h1 className="pub-scheme-title">{s.name}</h1>
              <div className="row" style={{ marginTop: '0.75rem' }}>
                <span className="chip chip--navy">{humanize(s.category)}</span>
                {s.subCategory && <span className="chip chip--navy">{s.subCategory}</span>}
                <span className="chip chip--navy">Regular plan</span>
              </div>
            </div>
            <div className="pub-scheme-nav">
              <span className="pub-scheme-nav__label">NAV</span>
              <span className="pub-scheme-nav__value num">₹{formatNav(s.nav)}</span>
              <span className="tiny">as on {formatDate(s.navDate)}</span>
            </div>
          </div>
          <div className="row" style={{ marginTop: '1.5rem' }}>
            <InvestButton id={s.id} name={s.name} />
            {s.factsheetUrl && (
              <ExtLink href={s.factsheetUrl} className="btn btn--outline-gold btn--lg">
                Factsheet
              </ExtLink>
            )}
          </div>
        </div>
      </header>

      <section className="section pub-tight-top">
        <div className="container stack-lg">
          <ul className="pub-returns" aria-label="Annualised returns">
            {[
              ['1 year', s.return1y],
              ['3 years', s.return3y],
              ['5 years', s.return5y],
              ['10 years', s.return10y],
            ].map(([label, v]) => (
              <li key={label} className="card">
                <span className="stat__label">{label} return</span>
                <span className="pub-returns__value">
                  <Pct value={v} />
                </span>
                <span className="tiny muted">{label === '1 year' ? 'Absolute' : 'Annualised (CAGR)'}</span>
              </li>
            ))}
          </ul>

          <div className="pub-scheme-grid">
            <div className="stack-lg">
              <section className="card" aria-labelledby="nav-h">
                <h2 id="nav-h" className="card__title">
                  NAV history (1 year)
                </h2>
                <NavChart s={s} />
              </section>
              {s.objective && (
                <section className="card" aria-labelledby="obj-h">
                  <h2 id="obj-h" className="card__title">
                    Investment objective
                  </h2>
                  <p style={{ margin: 0 }}>{s.objective}</p>
                </section>
              )}
              <section className="card" aria-labelledby="facts-h">
                <h2 id="facts-h" className="card__title">
                  Scheme facts
                </h2>
                <dl className="pub-facts">
                  {facts.map(([k, v, wide]) => (
                    <div key={k} style={wide ? { gridColumn: '1 / -1' } : undefined}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
            <aside className="stack-lg">
              <section className="card pub-risk-card" aria-labelledby="risk-h">
                <h2 id="risk-h" className="card__title">
                  Riskometer
                </h2>
                <RiskOMeter risk={s.risk} sidUrl={s.sidUrl} schemeName={s.name} size={240} />
              </section>
              <section className="card card--accent" aria-labelledby="docs-h">
                <h2 id="docs-h" className="card__title">
                  Scheme documents
                </h2>
                <ul className="pub-doclinks">
                  {s.sidUrl && (
                    <li>
                      <ExtLink href={s.sidUrl}>Scheme Information Document, KIM and factsheet</ExtLink>
                    </li>
                  )}
                  {s.factsheetUrl && (
                    <li>
                      <ExtLink href={s.factsheetUrl}>Latest factsheet</ExtLink>
                    </li>
                  )}
                  {!s.sidUrl && !s.factsheetUrl && <li className="muted small">Documents are available on the AMC’s website.</li>}
                </ul>
              </section>
              <section className="card" aria-labelledby="comm-h">
                <h2 id="comm-h" className="card__title">
                  Commission disclosure
                </h2>
                <p className="small" style={{ margin: 0 }}>
                  {s.trailCommissionPct != null ? (
                    <>
                      Aureus Finserve receives a trail commission of <strong>{formatPct(s.trailCommissionPct)} p.a.</strong> from the AMC for this scheme; regular plan.
                    </>
                  ) : (
                    <>Aureus Finserve receives a trail commission from the AMC for this scheme; regular plan.</>
                  )}{' '}
                  <Link to="/legal/commission">Read more</Link>
                </p>
              </section>
            </aside>
          </div>

          <p className="small muted" style={{ margin: 0 }}>
            Past performance may or may not be sustained in future. Returns are based on NAV and do not account for taxes or exit loads. Data is provided for
            information and is not a recommendation to buy or sell.
          </p>
          <StandardDisclaimer />
        </div>
      </section>
    </>
  );
}
