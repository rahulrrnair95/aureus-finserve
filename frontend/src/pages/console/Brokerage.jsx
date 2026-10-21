import { useState } from 'react';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { useTitle } from '../../utils/useTitle';
import { formatINR, formatMonth, formatPct } from '../../utils/format';
import DataTable from '../../components/DataTable';
import Money from '../../components/Money';
import { Checkbox, Field, Input } from '../../components/Field';
import { Async, EmptyState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { previousMonth } from './parts/common';
import { Kpi, PageTitle } from './parts/ui';

const num = (v) => Number(v) || 0;

export default function Brokerage() {
  useTitle('Brokerage');
  const [month, setMonth] = useState(previousMonth());
  const [onlyOpen, setOnlyOpen] = useState(false);
  const q = useApi(() => adminApi.brokerage(month), [month], { enabled: /^\d{4}-\d{2}$/.test(month) });

  const columns = [
    { key: 'amc', header: 'AMC', primary: true },
    { key: 'schemeName', header: 'Scheme' },
    { key: 'month', header: 'Month', render: (r) => formatMonth(r.month) },
    { key: 'aum', header: 'AUM', num: true, render: (r) => formatINR(r.aum, { decimals: 0 }) },
    { key: 'ratePct', header: 'Rate', num: true, render: (r) => formatPct(r.ratePct) },
    { key: 'expected', header: 'Expected', num: true, render: (r) => formatINR(r.expected) },
    { key: 'received', header: 'Received', num: true, render: (r) => formatINR(r.received) },
    { key: 'difference', header: 'Difference', num: true, render: (r) => <Money value={r.difference} colored signed /> },
    { key: 'reconciled', header: 'Reconciled', render: (r) => (r.reconciled ? <span className="chip chip--success">Reconciled</span> : <span className="chip chip--warning">Unreconciled</span>) },
  ];

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Administration" title="Brokerage reconciliation" />
      <div className="card con-filters" role="search" aria-label="Brokerage filters">
        <Field label="Month" hint="Defaults to the previous month">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} max={new Date().toISOString().slice(0, 7)} />
        </Field>
        <div className="con-filters__check">
          <Checkbox label="Show unreconciled only" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
        </div>
      </div>

      {!/^\d{4}-\d{2}$/.test(month) ? (
        <EmptyState title="Choose a month" icon="calc" />
      ) : (
        <Async state={q} skeleton={<SkeletonBlock rows={6} height={28} />} empty={(d) => !d.rows?.length} emptyView={<EmptyState title={`No brokerage rows for ${formatMonth(month)}`} icon="rupee" />}>
          {(d) => {
            const unrec = d.rows.filter((r) => !r.reconciled);
            const rows = onlyOpen ? unrec : d.rows;
            const expected = onlyOpen ? rows.reduce((s, r) => s + num(r.expected), 0) : num(d.totals?.expected);
            const received = onlyOpen ? rows.reduce((s, r) => s + num(r.received), 0) : num(d.totals?.received);
            const diff = received - expected;
            return (
              <>
                <section aria-label="Summary" className="grid grid-4">
                  <Kpi label="Expected" value={formatINR(expected, { decimals: 0 })} sub={onlyOpen ? 'Unreconciled rows' : 'All rows'} />
                  <Kpi label="Received" value={formatINR(received, { decimals: 0 })} />
                  <Kpi label="Difference" value={<Money value={diff} decimals={0} colored signed />} />
                  <Kpi label="Unreconciled" value={`${unrec.length} of ${d.rows.length}`} sub={unrec.length ? 'Highlighted in the table' : 'All reconciled'} />
                </section>
                {rows.length ? (
                  <DataTable
                    caption={`Brokerage for ${formatMonth(month)}`}
                    rowKey={(r, i) => `${r.amc}-${r.schemeName}-${i}`}
                    columns={columns}
                    rows={rows}
                    highlight={(r) => !r.reconciled}
                    footer={
                      <tr>
                        <td colSpan={5}>{onlyOpen ? 'Total (unreconciled)' : 'Total'}</td>
                        <td className="is-num">{formatINR(expected)}</td>
                        <td className="is-num">{formatINR(received)}</td>
                        <td className="is-num">
                          <Money value={diff} colored signed />
                        </td>
                        <td />
                      </tr>
                    }
                  />
                ) : (
                  <EmptyState title="Everything is reconciled for this month" icon="check" />
                )}
              </>
            );
          }}
        </Async>
      )}
    </div>
  );
}
