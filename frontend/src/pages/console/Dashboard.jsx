import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { useTitle } from '../../utils/useTitle';
import { useAuth } from '../../auth/AuthContext';
import { formatINR, formatLakhCrore, formatMonth, formatNumber } from '../../utils/format';
import { AXIS_TICK, CHART_COLORS, CHART_GOLD, CHART_GRID, CHART_NAVY, ChartTooltip, Legend, compactAxis } from '../../components/Charts';
import DataTable from '../../components/DataTable';
import { EmptyState, ErrorState } from '../../components/States';
import { Skeleton, SkeletonCards } from '../../components/Skeleton';
import { Kpi, PageTitle } from './parts/ui';

const FLOW_SERIES = [
  { key: 'inflow', label: 'Inflow', color: CHART_NAVY },
  { key: 'outflow', label: 'Outflow', color: CHART_GOLD },
  { key: 'net', label: 'Net flow', color: CHART_COLORS[2] },
];

const compactValue = (v) => formatLakhCrore(v);
const sumOf = (list, key = 'value') => (list || []).reduce((s, x) => s + (Number(x[key]) || 0), 0);

export default function Dashboard() {
  useTitle('Dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const q = useApi(() => adminApi.dashboard(), []);
  const d = q.data;

  return (
    <div className="stack-lg">
      <PageTitle eyebrow={user?.role === 'ADMIN' ? 'Firm overview' : 'My book'} title="Dashboard" />

      {q.error && !d ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : !d ? (
        <>
          <SkeletonCards count={4} />
          <SkeletonCards count={4} height={90} />
          <div className="grid grid-2">
            <Skeleton height={320} style={{ borderRadius: 8 }} />
            <Skeleton height={320} style={{ borderRadius: 8 }} />
          </div>
        </>
      ) : (
        <>
          <section aria-labelledby="con-kpi-h">
            <h2 id="con-kpi-h" className="sr-only">
              Key figures
            </h2>
            <div className="grid grid-4 con-kpis">
              <Kpi label="Assets under management" value={formatLakhCrore(d.aum)} icon="pie" />
              <Kpi label="Clients" value={formatNumber(d.clients)} icon="users" to="/console/clients" sub="View clients" />
              <Kpi label="Active SIPs" value={formatNumber(d.activeSips)} icon="repeat" />
              <Kpi label="SIP book (monthly)" value={formatINR(d.sipBook, { decimals: 0 })} icon="rupee" />
              <Kpi label="New leads" value={formatNumber(d.newLeads)} icon="inbox" to="/console/leads" sub="View leads" />
              {d.pendingKyc !== undefined && d.pendingKyc !== null && (
                <Kpi label="Pending KYC" value={formatNumber(d.pendingKyc)} icon="shield" to="/console/kyc?pending=1" sub="Review KYC requests" />
              )}
              <Kpi label="Open tickets" value={formatNumber(d.openTickets)} icon="ticket" to="/console/tickets" sub="View service desk" />
              <Kpi label="Orders pending approval" value={formatNumber(d.pendingOrders)} icon="cart" to="/console/orders?status=PENDING_APPROVAL" sub="Awaiting client OTP" />
            </div>
          </section>

          <section className="card" aria-labelledby="con-flows-h">
            <div className="card__head">
              <h2 id="con-flows-h" className="card__title">
                Flows — last 12 months
              </h2>
            </div>
            {d.flows?.length ? (
              <>
                <div className="chart chart--lg" role="img" aria-label={flowsSummary(d.flows)}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.flows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
                      <CartesianGrid stroke={CHART_GRID} vertical={false} />
                      <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART_GRID }} minTickGap={8} />
                      <YAxis tickFormatter={compactAxis} tick={AXIS_TICK} tickLine={false} axisLine={false} width={64} />
                      <Tooltip cursor={{ fill: 'rgba(11,33,55,0.05)' }} content={<ChartTooltip labelFormatter={formatMonth} valueFormatter={compactValue} />} />
                      {FLOW_SERIES.map((s) => (
                        <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Legend items={FLOW_SERIES.map((s) => ({ label: s.label, color: s.color, value: formatLakhCrore(sumOf(d.flows, s.key)) }))} />
                <p className="tiny muted">Legend totals are for the 12 months shown.</p>
              </>
            ) : (
              <EmptyState title="No flows recorded yet" icon="chart" />
            )}
          </section>

          <div className="grid grid-2">
            <section className="card" aria-labelledby="con-cat-h">
              <div className="card__head">
                <h2 id="con-cat-h" className="card__title">
                  AUM by category
                </h2>
              </div>
              <Donut data={d.aumByCategory} label="AUM by category" />
            </section>

            <section className="card" aria-labelledby="con-amc-h">
              <div className="card__head">
                <h2 id="con-amc-h" className="card__title">
                  AUM by AMC
                </h2>
              </div>
              <AmcBars data={d.aumByAmc} />
            </section>
          </div>

          <section className="card" aria-labelledby="con-top-h">
            <div className="card__head">
              <h2 id="con-top-h" className="card__title">
                Top clients by AUM
              </h2>
            </div>
            {d.topClients?.length ? (
              <DataTable
                caption="Top clients by AUM"
                rows={d.topClients.map((r, i) => ({ ...r, rank: i + 1 }))}
                onRowClick={(r) => navigate(`/console/clients/${r.id}`)}
                rowLabel={(r) => `Open client ${r.name}`}
                columns={[
                  { key: 'rank', header: '#', mobile: false },
                  { key: 'name', header: 'Client', primary: true, render: (r) => <span className="con-link-text">{r.name}</span> },
                  { key: 'aum', header: 'AUM', num: true, render: (r) => formatINR(r.aum, { decimals: 0 }) },
                ]}
              />
            ) : (
              <EmptyState title="No clients yet" icon="users" />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function flowsSummary(flows) {
  return `Bar chart of monthly inflow, outflow and net flow from ${formatMonth(flows[0].month)} to ${formatMonth(flows[flows.length - 1].month)}. Total inflow ${formatLakhCrore(
    sumOf(flows, 'inflow'),
  )}, outflow ${formatLakhCrore(sumOf(flows, 'outflow'))}, net ${formatLakhCrore(sumOf(flows, 'net'))}.`;
}

function Donut({ data, label }) {
  if (!data?.length) return <EmptyState title="No AUM yet" icon="pie" />;
  const total = sumOf(data);
  const pct = (v) => (total ? `${((Number(v) / total) * 100).toFixed(1)}%` : '—');
  const items = data.map((x, i) => ({ label: x.name, color: CHART_COLORS[i % CHART_COLORS.length], value: `${formatLakhCrore(x.value)} · ${pct(x.value)}` }));
  return (
    <>
      <div className="chart" role="img" aria-label={`${label}: ${data.map((x) => `${x.name} ${formatLakhCrore(x.value)} (${pct(x.value)})`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {data.map((x, i) => (
                <Cell key={x.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={compactValue} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <Legend items={items} />
    </>
  );
}

function AmcBars({ data }) {
  if (!data?.length) return <EmptyState title="No AUM yet" icon="chart" />;
  const rows = [...data].sort((a, b) => Number(b.value) - Number(a.value));
  const height = Math.max(220, rows.length * 38 + 40);
  return (
    <div className="chart" style={{ height }} role="img" aria-label={`Horizontal bar chart of AUM by AMC: ${rows.map((x) => `${x.name} ${formatLakhCrore(x.value)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} horizontal={false} />
          <XAxis type="number" tickFormatter={compactAxis} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={120} tickFormatter={(v) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
          <Tooltip cursor={{ fill: 'rgba(11,33,55,0.05)' }} content={<ChartTooltip valueFormatter={compactValue} />} />
          <Bar dataKey="value" name="AUM" fill={CHART_NAVY} radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
