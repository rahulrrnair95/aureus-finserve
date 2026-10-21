import { useEffect, useState } from 'react';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi } from '../../api/endpoints';
import { useInvestor } from '../../layouts/InvestorLayout';
import DataTable from '../../components/DataTable';
import { Field, Input, Select } from '../../components/Field';
import Money from '../../components/Money';
import StatusChip from '../../components/StatusChip';
import Tabs from '../../components/Tabs';
import { Alert, Async, EmptyState, ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { formatDate, formatNav, formatUnits, humanize, toISODate } from '../../utils/format';
import { DownloadButton, PageTitle, TXN_TYPES, txnLabel } from './parts/common';

const TABS = [
  { id: 'statement', label: 'Account statement' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'gains', label: 'Capital gains' },
];

export default function Reports() {
  useTitle('Reports');
  const { memberParam, memberName } = useInvestor();
  const [tab, setTab] = useState('statement');
  return (
    <div className="stack-lg">
      <PageTitle eyebrow={`Reports · ${memberName}`} title="Statements & reports" />
      <div>
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Report type" />
        <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
          {tab === 'statement' && <Statement member={memberParam} memberName={memberName} />}
          {tab === 'transactions' && <Transactions member={memberParam} />}
          {tab === 'gains' && <CapitalGains member={memberParam} />}
        </div>
      </div>
    </div>
  );
}

function DownloadPair({ kind, query, base }) {
  return (
    <div className="row">
      <DownloadButton onDownload={() => investorApi.downloadReport(kind, { ...query, format: 'pdf' }, `${base}.pdf`)}>PDF</DownloadButton>
      <DownloadButton onDownload={() => investorApi.downloadReport(kind, { ...query, format: 'xlsx' }, `${base}.xlsx`)}>Excel</DownloadButton>
    </div>
  );
}

function Statement({ member, memberName }) {
  return (
    <section className="card card--accent" aria-labelledby="inv-rep-st">
      <div className="card__head">
        <div>
          <h2 id="inv-rep-st" className="card__title">
            Consolidated account statement
          </h2>
          <p className="small muted" style={{ margin: 0 }}>
            Holdings, valuation and transaction summary for {memberName}, as per the latest available NAV.
          </p>
        </div>
        <DownloadPair kind="statement" query={{ member }} base="statement" />
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>
        Statements are generated from records held by Aureus Finserve as your distributor. For the official record, refer to the CAS issued by the RTAs / depositories.
      </p>
    </section>
  );
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  return { from: toISODate(from), to: toISODate(to) };
}

function Transactions({ member }) {
  const [range, setRange] = useState(defaultRange);
  const [type, setType] = useState('');
  const invalid = range.from && range.to && range.from > range.to;
  const q = useApi(() => investorApi.transactions({ member, from: range.from, to: range.to, type: type || undefined }), [member, range.from, range.to, type], { enabled: !invalid });

  const columns = [
    { key: 'date', header: 'Date', primary: true, render: (t) => formatDate(t.date) },
    {
      key: 'scheme',
      header: 'Scheme',
      render: (t) => (
        <span>
          {t.schemeName}
          <br />
          <span className="tiny muted">Folio {t.folioNo}</span>
        </span>
      ),
    },
    member === 'all' && { key: 'investorName', header: 'Investor' },
    { key: 'type', header: 'Type', render: (t) => txnLabel(t.type) },
    { key: 'amount', header: 'Amount', num: true, render: (t) => <Money value={t.amount} /> },
    { key: 'units', header: 'Units', num: true, render: (t) => formatUnits(t.units) },
    { key: 'nav', header: 'NAV', num: true, render: (t) => formatNav(t.nav) },
  ].filter(Boolean);

  return (
    <section className="card" aria-labelledby="inv-rep-tx">
      <div className="card__head">
        <h2 id="inv-rep-tx" className="card__title">
          Transaction history
        </h2>
        <DownloadPair kind="transactions" query={{ member, from: range.from, to: range.to }} base="transactions" />
      </div>
      <div className="form-grid form-grid--3 inv-filters">
        <Field label="From">
          <Input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </Field>
        <Field label="To" error={invalid ? 'The end date must be after the start date.' : undefined}>
          <Input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)} placeholder="All types" options={TXN_TYPES.map((t) => ({ value: t, label: txnLabel(t) }))} />
        </Field>
      </div>
      {invalid ? null : (
        <Async state={q} skeleton={<SkeletonBlock rows={6} />} empty={(d) => !d?.length} emptyView={<EmptyState title="No transactions in this period" icon="list" />}>
          {(rows) => (
            <>
              <p className="tiny muted">
                {rows.length} transaction{rows.length === 1 ? '' : 's'}, newest first
              </p>
              <DataTable caption="Transaction history" columns={columns} rows={rows} rowKey="id" />
            </>
          )}
        </Async>
      )}
    </section>
  );
}

function CapitalGains({ member }) {
  const fys = useApi(() => investorApi.financialYears(), []);
  const [fy, setFy] = useState('');
  useEffect(() => {
    if (!fy && Array.isArray(fys.data) && fys.data.length) setFy(fys.data[0]);
  }, [fys.data, fy]);
  const cg = useApi(() => investorApi.capitalGains(fy, member), [fy, member], { enabled: !!fy });

  const columns = [
    {
      key: 'scheme',
      header: 'Scheme',
      primary: true,
      render: (r) => (
        <span>
          {r.schemeName}
          <br />
          <span className="tiny muted">
            Folio {r.folioNo} · {humanize(r.assetClass)}
          </span>
        </span>
      ),
    },
    { key: 'purchaseDate', header: 'Purchased', render: (r) => formatDate(r.purchaseDate) },
    { key: 'redemptionDate', header: 'Redeemed', render: (r) => formatDate(r.redemptionDate) },
    { key: 'units', header: 'Units', num: true, render: (r) => formatUnits(r.units) },
    { key: 'costValue', header: 'Cost', num: true, render: (r) => <Money value={r.costValue} /> },
    { key: 'saleValue', header: 'Sale value', num: true, render: (r) => <Money value={r.saleValue} /> },
    { key: 'gain', header: 'Gain', num: true, render: (r) => <Money value={r.gain} colored signed /> },
    { key: 'term', header: 'Term', render: (r) => <StatusChip status={r.term} label={r.term === 'STCG' ? 'Short term' : 'Long term'} /> },
  ];

  if (fys.loading && !fys.data) return <SkeletonBlock rows={5} />;
  if (fys.error && !fys.data) return <ErrorState error={fys.error} onRetry={fys.reload} />;
  if (!fys.data?.length)
    return (
      <div className="card">
        <EmptyState title="No financial years available" icon="file">
          Capital gains appear once you have redeemed units.
        </EmptyState>
      </div>
    );

  return (
    <section className="card" aria-labelledby="inv-rep-cg">
      <div className="card__head">
        <h2 id="inv-rep-cg" className="card__title">
          Capital gains
        </h2>
        {fy && <DownloadPair kind="capital-gains" query={{ fy, member }} base={`capital-gains-${fy}`} />}
      </div>
      <div className="form-grid form-grid--3 inv-filters">
        <Field label="Financial year">
          <Select value={fy} onChange={(e) => setFy(e.target.value)} options={fys.data.map((y) => ({ value: y, label: `FY ${y}` }))} />
        </Field>
      </div>
      {fy && (
        <Async state={cg} skeleton={<SkeletonBlock rows={6} />}>
          {(d) => (
            <div className="stack">
              <div className="grid grid-3">
                <div className="inv-mini-stat stat">
                  <span className="stat__label">Short-term (STCG)</span>
                  <span className="stat__value">
                    <Money value={d.totals?.stcg} colored signed />
                  </span>
                </div>
                <div className="inv-mini-stat stat">
                  <span className="stat__label">Long-term (LTCG)</span>
                  <span className="stat__value">
                    <Money value={d.totals?.ltcg} colored signed />
                  </span>
                </div>
                <div className="inv-mini-stat stat">
                  <span className="stat__label">Total</span>
                  <span className="stat__value">
                    <Money value={d.totals?.total} colored signed />
                  </span>
                </div>
              </div>
              {d.rows?.length ? (
                <DataTable caption={`Capital gains for FY ${d.fy || fy}`} columns={columns} rows={d.rows} rowKey={(r, i) => `${r.folioNo}-${r.redemptionDate}-${i}`} />
              ) : (
                <EmptyState title={`No redemptions in FY ${d.fy || fy}`} icon="file" />
              )}
              <Alert type="info">
                Figures are indicative and based on transactions recorded with us. Please verify with your CAS and consult your tax adviser before filing.
              </Alert>
            </div>
          )}
        </Async>
      )}
    </section>
  );
}
