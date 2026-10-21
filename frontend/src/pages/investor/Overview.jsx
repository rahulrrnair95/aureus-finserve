import { Link } from 'react-router-dom';
import { Area, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi } from '../../api/endpoints';
import { useInvestor } from '../../layouts/InvestorLayout';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import Money, { Pct } from '../../components/Money';
import { RiskBadge } from '../../components/RiskOMeter';
import { Alert, Async, EmptyState } from '../../components/States';
import { SkeletonBlock, SkeletonCards } from '../../components/Skeleton';
import { AXIS_TICK, CHART_COLORS, CHART_GOLD, CHART_GRID, CHART_NAVY, ChartTooltip, Legend, compactAxis } from '../../components/Charts';
import { formatDate, formatINR, formatLakhCrore, formatMonth, formatPct, humanize } from '../../utils/format';
import { PageTitle, telLink, waLink } from './parts/common';

export default function Overview() {
  useTitle('Portfolio overview');
  const { memberParam, memberName } = useInvestor();
  const q = useApi(() => investorApi.portfolio(memberParam), [memberParam]);
  const pending = useApi(() => investorApi.orders('PENDING_APPROVAL'), []);
  const pendingCount = Array.isArray(pending.data) ? pending.data.length : 0;

  return (
    <div className="stack-lg">
      <PageTitle eyebrow={`Portfolio · ${memberName}`} title="Overview">
        <Button variant="outline" size="sm" to="/app/reports">
          <Icon name="file" size={16} /> Statements
        </Button>
        <Button size="sm" to="/app/transact">
          Invest now
        </Button>
      </PageTitle>

      {pendingCount > 0 && (
        <Alert
          type="warning"
          title="Action needed"
          action={
            <Button variant="outline" size="sm" to="/app/orders?status=PENDING_APPROVAL">
              Review
            </Button>
          }
        >
          Your RM has proposed {pendingCount} order{pendingCount > 1 ? 's' : ''} awaiting your approval.{' '}
          <Link to="/app/orders?status=PENDING_APPROVAL">View proposed orders</Link>
        </Alert>
      )}

      <Async
        state={q}
        skeleton={
          <div className="stack-lg">
            <SkeletonCards count={4} />
            <SkeletonBlock rows={6} />
          </div>
        }
        empty={(d) => !d || (!d.holdingsCount && !Number(d.currentValue))}
        emptyView={
          <div className="card">
            <EmptyState
              title="Your portfolio is empty"
              icon="pie"
              action={
                <Button to="/app/transact" variant="primary">
                  Start investing
                </Button>
              }
            >
              {memberParam ? `There are no holdings for ${memberName} yet.` : 'Once your first investment is allotted, your portfolio will appear here.'}
            </EmptyState>
          </div>
        }
      >
        {(d) => <PortfolioView d={d} />}
      </Async>

      <RmCard />
    </div>
  );
}

function PortfolioView({ d }) {
  const gain = Number(d.gain);
  const noXirr = d.xirr === null || d.xirr === undefined;
  return (
    <>
      <section aria-labelledby="inv-ov-summary">
        <h2 id="inv-ov-summary" className="sr-only">
          Summary
        </h2>
        <div className="grid grid-4">
          <div className="card card--navy stat">
            <span className="stat__label">Current value</span>
            <span className="stat__value">{formatINR(d.currentValue)}</span>
            <span className="stat__sub">As of {formatDate(d.asOf)}</span>
          </div>
          <div className="card stat">
            <span className="stat__label">Invested</span>
            <span className="stat__value">{formatINR(d.invested)}</span>
            <span className="stat__sub">
              {d.holdingsCount} holding{d.holdingsCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="card stat">
            <span className="stat__label">Total gain</span>
            <span className={`stat__value ${gain > 0 ? 'pos' : gain < 0 ? 'neg' : ''}`}>
              {gain > 0 ? '+' : ''}
              {formatINR(d.gain)}
            </span>
            <span className="stat__sub">
              <Pct value={d.gainPct} /> absolute
            </span>
          </div>
          <div className="card stat">
            <span className="stat__label">XIRR</span>
            <span className="stat__value">{noXirr ? '—' : <Pct value={d.xirr} />}</span>
            <span className="stat__sub">{noXirr ? 'Not enough history to calculate yet' : 'Annualised, since first investment'}</span>
          </div>
        </div>
      </section>

      <div className="inv-ov-grid">
        <section className="card" aria-labelledby="inv-ov-growth">
          <div className="card__head">
            <h2 id="inv-ov-growth" className="card__title">
              Value vs invested
            </h2>
            <span className="tiny muted">Monthly</span>
          </div>
          <GrowthChart data={d.valueHistory || []} />
        </section>
        <section className="card" aria-labelledby="inv-ov-alloc">
          <div className="card__head">
            <h2 id="inv-ov-alloc" className="card__title">
              Asset allocation
            </h2>
          </div>
          <AllocationChart data={d.allocation || []} />
        </section>
      </div>

      <div className="inv-ov-grid">
        <section className="card" aria-labelledby="inv-ov-top">
          <div className="card__head">
            <h2 id="inv-ov-top" className="card__title">
              Top holdings
            </h2>
            <Link to="/app/holdings" className="small">
              View all holdings
            </Link>
          </div>
          {d.topHoldings?.length ? (
            <ul className="inv-toplist">
              {d.topHoldings.map((h) => (
                <li key={h.folioId}>
                  <div className="inv-toplist__main">
                    <Link to="/app/holdings" className="inv-toplist__name">
                      {h.schemeName}
                    </Link>
                    <span className="tiny muted">
                      {h.amc} · Folio {h.folioNo}
                    </span>
                    <RiskBadge risk={h.risk} />
                  </div>
                  <div className="inv-toplist__fig">
                    <Money value={h.value} />
                    <Pct value={h.gainPct} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No holdings to show.</p>
          )}
        </section>
        <section className="card card--accent" aria-labelledby="inv-ov-sip">
          <div className="card__head">
            <h2 id="inv-ov-sip" className="card__title">
              Systematic investments
            </h2>
          </div>
          <div className="grid grid-2">
            <div className="stat">
              <span className="stat__label">Active SIPs</span>
              <span className="stat__value">{d.activeSips ?? 0}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Monthly SIP</span>
              <span className="stat__value">{formatINR(d.monthlySipAmount, { decimals: 0 })}</span>
            </div>
          </div>
          <div className="row" style={{ marginTop: '1.25rem' }}>
            <Button variant="outline" size="sm" to="/app/sips">
              Manage SIPs
            </Button>
            <Button variant="ghost" size="sm" to="/app/transact?type=SIP">
              Start a new SIP
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

function GrowthChart({ data }) {
  if (!data.length) return <p className="muted small">Value history will appear once you have a few months of investments.</p>;
  const last = data[data.length - 1];
  const summary = `Portfolio value ${formatLakhCrore(last.value)} against ${formatLakhCrore(last.invested)} invested as of ${formatMonth(last.date)}.`;
  return (
    <>
      <div className="chart" role="img" aria-label={`Chart of portfolio value and amount invested over ${data.length} months. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="invValFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_NAVY} stopOpacity={0.22} />
                <stop offset="100%" stopColor={CHART_NAVY} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatMonth} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART_GRID }} minTickGap={24} />
            <YAxis tickFormatter={compactAxis} tick={AXIS_TICK} tickLine={false} axisLine={false} width={64} />
            <Tooltip content={<ChartTooltip labelFormatter={formatMonth} />} />
            <Area type="monotone" dataKey="value" name="Current value" stroke={CHART_NAVY} strokeWidth={2} fill="url(#invValFill)" />
            <Line type="stepAfter" dataKey="invested" name="Invested" stroke={CHART_GOLD} strokeWidth={2} strokeDasharray="5 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={[
          { label: 'Current value', color: CHART_NAVY },
          { label: 'Invested', color: CHART_GOLD },
        ]}
      />
      <p className="tiny muted" style={{ marginTop: '0.5rem' }}>
        {summary}
      </p>
    </>
  );
}

function AllocationChart({ data }) {
  const rows = data.filter((a) => Number(a.value) > 0).map((a) => ({ ...a, label: humanize(a.assetClass) }));
  if (!rows.length) return <p className="muted small">No allocation data yet.</p>;
  const label = rows.map((a) => `${a.label} ${formatPct(a.pct, { decimals: 1 })}`).join(', ');
  return (
    <>
      <div className="chart chart--sm" role="img" aria-label={`Donut chart of asset allocation: ${label}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="#fff" strokeWidth={2}>
              {rows.map((a, i) => (
                <Cell key={a.assetClass} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <Legend
        items={rows.map((a, i) => ({
          label: `${a.label} · ${formatINR(a.value, { decimals: 0 })}`,
          color: CHART_COLORS[i % CHART_COLORS.length],
          value: formatPct(a.pct, { decimals: 1 }),
        }))}
      />
    </>
  );
}

function RmCard() {
  const rm = useApi(() => investorApi.rm(), []);
  if (rm.loading && !rm.data) return <SkeletonBlock rows={2} />;
  if (rm.error || !rm.data) return null;
  const r = rm.data;
  const wa = waLink(r.whatsapp || r.phone);
  const tel = telLink(r.phone);
  const initials = (r.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  return (
    <section className="card inv-rm" aria-labelledby="inv-ov-rm">
      <div className="inv-rm__who">
        <span className="inv-rm__avatar" aria-hidden="true">
          {initials}
        </span>
        <div>
          <span className="eyebrow">Your relationship manager</span>
          <h2 id="inv-ov-rm" className="card__title" style={{ margin: 0 }}>
            {r.name}
          </h2>
          {r.euin && <span className="tiny muted">EUIN {r.euin}</span>}
        </div>
      </div>
      <div className="row">
        {tel && (
          <Button variant="outline" size="sm" href={tel}>
            <Icon name="phone" size={16} /> Call
          </Button>
        )}
        {wa && (
          <Button variant="outline" size="sm" href={wa} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" size={16} /> WhatsApp<span className="sr-only"> (opens in new tab)</span>
          </Button>
        )}
        {r.email && (
          <Button variant="outline" size="sm" href={`mailto:${r.email}`}>
            <Icon name="mail" size={16} /> Email
          </Button>
        )}
        <Button variant="ghost" size="sm" to="/app/rm">
          Request a call back
        </Button>
      </div>
    </section>
  );
}
