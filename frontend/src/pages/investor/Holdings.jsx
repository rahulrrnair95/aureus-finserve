import { useMemo, useState } from 'react';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi } from '../../api/endpoints';
import { useInvestor } from '../../layouts/InvestorLayout';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import { Drawer } from '../../components/Modal';
import Money, { Pct } from '../../components/Money';
import { RiskBadge } from '../../components/RiskOMeter';
import { Async, EmptyState, ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { formatDate, formatINR, formatNav, formatUnits, humanize } from '../../utils/format';
import { InfoList, PageTitle, txnLabel } from './parts/common';

export default function Holdings() {
  useTitle('Holdings');
  const { memberParam, memberName } = useInvestor();
  const q = useApi(() => investorApi.holdings(memberParam), [memberParam]);
  const [sel, setSel] = useState(null);
  const showInvestor = memberParam === 'all';

  return (
    <div className="stack-lg">
      <PageTitle eyebrow={`Portfolio · ${memberName}`} title="Holdings">
        <Button size="sm" to="/app/transact">
          Invest now
        </Button>
      </PageTitle>
      <Async
        state={q}
        skeleton={<SkeletonBlock rows={8} height={22} />}
        empty={(d) => !d?.length}
        emptyView={
          <div className="card">
            <EmptyState
              title="No holdings yet"
              icon="pie"
              action={
                <Button to="/app/transact" variant="primary">
                  Start investing
                </Button>
              }
            >
              Your mutual fund folios will appear here once your first order is allotted.
            </EmptyState>
          </div>
        }
      >
        {(rows) => <HoldingsTable rows={rows} showInvestor={showInvestor} onSelect={setSel} />}
      </Async>
      {sel && <HoldingDrawer holding={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function HoldingsTable({ rows, showInvestor, onSelect }) {
  const totals = useMemo(() => {
    const value = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
    const invested = rows.reduce((s, r) => s + (Number(r.invested) || 0), 0);
    const gain = value - invested;
    return { value, invested, gain, gainPct: invested ? (gain / invested) * 100 : null };
  }, [rows]);

  const columns = [
    {
      key: 'scheme',
      header: 'Scheme',
      primary: true,
      render: (h) => (
        <div className="inv-scheme-cell">
          <span className="inv-scheme-cell__name">{h.schemeName}</span>
          <span className="tiny muted">
            {h.amc}
            {h.subCategory ? ` · ${h.subCategory}` : h.category ? ` · ${humanize(h.category)}` : ''}
          </span>
          <RiskBadge risk={h.risk} />
        </div>
      ),
    },
    showInvestor && { key: 'investorName', header: 'Investor' },
    { key: 'folioNo', header: 'Folio', render: (h) => <span className="num">{h.folioNo}</span> },
    { key: 'units', header: 'Units', num: true, render: (h) => formatUnits(h.units) },
    {
      key: 'nav',
      header: 'NAV',
      num: true,
      render: (h) => (
        <span>
          {formatNav(h.nav)}
          <br />
          <span className="tiny muted">{formatDate(h.navDate)}</span>
        </span>
      ),
    },
    { key: 'value', header: 'Current value', num: true, render: (h) => <Money value={h.value} /> },
    { key: 'invested', header: 'Invested', num: true, render: (h) => <Money value={h.invested} /> },
    {
      key: 'gain',
      header: 'Gain',
      num: true,
      render: (h) => (
        <span>
          <Money value={h.gain} colored signed />
          <br />
          <Pct value={h.gainPct} />
        </span>
      ),
    },
    { key: 'xirr', header: 'XIRR', num: true, render: (h) => <Pct value={h.xirr} /> },
  ].filter(Boolean);

  const lead = showInvestor ? 4 : 3;
  return (
    <>
      <div className="grid grid-3">
        <div className="card stat">
          <span className="stat__label">Current value</span>
          <span className="stat__value">{formatINR(totals.value)}</span>
          <span className="stat__sub">
            {rows.length} folio{rows.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="card stat">
          <span className="stat__label">Invested</span>
          <span className="stat__value">{formatINR(totals.invested)}</span>
        </div>
        <div className="card stat">
          <span className="stat__label">Gain</span>
          <span className="stat__value">
            <Money value={totals.gain} colored signed />
          </span>
          <span className="stat__sub">
            <Pct value={totals.gainPct} /> absolute
          </span>
        </div>
      </div>
      <section className="card" aria-labelledby="inv-hold-h">
        <div className="card__head">
          <h2 id="inv-hold-h" className="card__title">
            Your folios
          </h2>
          <span className="tiny muted">Select a holding to see its transactions</span>
        </div>
        <DataTable
          caption="Mutual fund holdings"
          columns={columns}
          rows={rows}
          rowKey="folioId"
          onRowClick={onSelect}
          rowLabel={(h) => `${h.schemeName}, folio ${h.folioNo}, view details`}
          footer={
            <tr>
              <td colSpan={lead + 1}>
                <strong>Total</strong>
              </td>
              <td className="is-num">
                <strong>
                  <Money value={totals.value} />
                </strong>
              </td>
              <td className="is-num">
                <Money value={totals.invested} />
              </td>
              <td className="is-num">
                <Money value={totals.gain} colored signed />
                <br />
                <Pct value={totals.gainPct} />
              </td>
              <td />
            </tr>
          }
        />
      </section>
    </>
  );
}

function HoldingDrawer({ holding: h, onClose }) {
  const q = useApi(() => investorApi.holdingTxns(h.folioId), [h.folioId]);
  const columns = [
    { key: 'date', header: 'Date', primary: true, render: (t) => formatDate(t.date) },
    { key: 'type', header: 'Type', render: (t) => txnLabel(t.type) },
    { key: 'amount', header: 'Amount', num: true, render: (t) => <Money value={t.amount} /> },
    { key: 'units', header: 'Units', num: true, render: (t) => formatUnits(t.units) },
    { key: 'nav', header: 'NAV', num: true, render: (t) => formatNav(t.nav) },
  ];
  return (
    <Drawer
      open
      title={h.schemeName}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" to={`/app/transact?type=REDEEM&folio=${h.folioId}`}>
            Redeem
          </Button>
          <Button to={`/app/transact?scheme=${h.schemeId}`}>Invest more</Button>
        </>
      }
    >
      <div className="stack-lg">
        <div className="stack">
          <div className="row">
            <RiskBadge risk={h.risk} />
            <span className="tiny muted">{h.amc}</span>
          </div>
          <InfoList
            items={[
              { label: 'Investor', value: h.investorName },
              { label: 'Folio', value: h.folioNo },
              { label: 'Units', value: formatUnits(h.units) },
              { label: 'NAV', value: `${formatNav(h.nav)} (${formatDate(h.navDate)})` },
              { label: 'Current value', value: <Money value={h.value} /> },
              { label: 'Invested', value: <Money value={h.invested} /> },
              {
                label: 'Gain',
                value: (
                  <>
                    <Money value={h.gain} colored signed /> (<Pct value={h.gainPct} />)
                  </>
                ),
              },
              { label: 'XIRR', value: <Pct value={h.xirr} /> },
            ]}
          />
        </div>
        <section aria-labelledby="inv-hold-txn">
          <h3 id="inv-hold-txn">Transactions</h3>
          {q.loading && !q.data ? (
            <SkeletonBlock rows={5} />
          ) : q.error && !q.data ? (
            <ErrorState error={q.error} onRetry={q.reload} />
          ) : !q.data?.length ? (
            <EmptyState title="No transactions yet" icon="list" />
          ) : (
            <DataTable caption={`Transactions in folio ${h.folioNo}`} columns={columns} rows={q.data} rowKey="id" />
          )}
        </section>
      </div>
    </Drawer>
  );
}
