import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import { Field, Input, Select } from '../../components/Field';
import { PageHead, Pagination, StandardDisclaimer } from '../../components/Misc';
import { Pct } from '../../components/Money';
import { RiskBadge, riskLabel } from '../../components/RiskOMeter';
import { EmptyState, ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useTitle } from '../../utils/useTitle';
import { RISK_LEVELS, formatDate, formatNav, humanize } from '../../utils/format';

const SIZE = 20;
const FILTER_KEYS = ['category', 'subCategory', 'amc', 'risk'];
const SORTS = [
  { value: 'return1y', label: '1-year return' },
  { value: 'return3y', label: '3-year return' },
  { value: 'return5y', label: '5-year return' },
  { value: 'return10y', label: '10-year return' },
  { value: 'aum', label: 'Fund size (AUM)' },
  { value: 'name', label: 'Name (A–Z)' },
];

const COLUMNS = [
  {
    key: 'name',
    header: 'Scheme',
    primary: true,
    render: (r) => (
      <div className="pub-fund-name">
        <Link to={`/funds/${r.id}`}>{r.name}</Link>
      </div>
    ),
  },
  { key: 'amc', header: 'AMC', render: (r) => <span className="small">{r.amc}</span> },
  {
    key: 'category',
    header: 'Category',
    render: (r) => (
      <span className="small">
        {humanize(r.category)}
        {r.subCategory && <span className="muted"> · {r.subCategory}</span>}
      </span>
    ),
  },
  {
    key: 'nav',
    header: 'NAV',
    num: true,
    render: (r) => (
      <span className="pub-nav-cell">
        <span className="num">₹{formatNav(r.nav)}</span>
        <span className="tiny muted">{formatDate(r.navDate)}</span>
      </span>
    ),
  },
  { key: 'return1y', header: '1Y', num: true, render: (r) => <Pct value={r.return1y} /> },
  { key: 'return3y', header: '3Y', num: true, render: (r) => <Pct value={r.return3y} /> },
  { key: 'return5y', header: '5Y', num: true, render: (r) => <Pct value={r.return5y} /> },
  { key: 'return10y', header: '10Y', num: true, render: (r) => <Pct value={r.return10y} /> },
  { key: 'risk', header: 'Risk', render: (r) => <RiskBadge risk={r.risk} /> },
];

export default function FundExplorer() {
  useTitle('Fund explorer');
  const [sp, setSp] = useSearchParams();
  const qParam = sp.get('q') || '';
  const page = Math.max(0, Number(sp.get('page')) || 0);
  const sort = sp.get('sort') || '';
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || '']));
  const [search, setSearch] = useState(qParam);

  const update = (patch, resetPage = true) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, String(v))));
    if (resetPage) next.delete('page');
    setSp(next, { replace: true });
  };

  // Keep input in sync when URL changes externally (e.g. back/forward)
  useEffect(() => setSearch(qParam), [qParam]);

  // Debounce search → URL
  useEffect(() => {
    if (search.trim() === qParam) return undefined;
    const t = setTimeout(() => update({ q: search.trim() }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const meta = useApi(() => publicApi.schemeFilters(), []);
  const key = sp.toString();
  const q = useApi(
    () => publicApi.schemes({ q: qParam, ...filters, sort, page, size: SIZE }),
    [key],
  );

  const f = meta.data || { amcs: [], categories: [], subCategories: [], risks: [] };
  const risks = f.risks?.length ? [...f.risks].sort((a, b) => RISK_LEVELS.indexOf(a) - RISK_LEVELS.indexOf(b)) : RISK_LEVELS;
  const hasFilters = qParam || FILTER_KEYS.some((k) => filters[k]) || sort;
  const clear = () => {
    setSearch('');
    setSp(new URLSearchParams(), { replace: true });
  };
  const withCurrent = (list, v) => (v && !list.includes(v) ? [v, ...list] : list);

  const data = q.data;
  let results;
  if (q.loading && !data) results = <SkeletonBlock rows={10} height={28} />;
  else if (q.error && !data) results = <ErrorState error={q.error} onRetry={q.reload} />;
  else if (!data?.items?.length)
    results = (
      <EmptyState title="No schemes match your filters" icon="search" action={hasFilters ? <Button variant="outline" onClick={clear}>Clear filters</Button> : null}>
        Try a different search term or remove a filter.
      </EmptyState>
    );
  else
    results = (
      <div className={q.loading ? 'pub-loading' : undefined} aria-busy={q.loading || undefined}>
        <DataTable columns={COLUMNS} rows={data.items} caption="Mutual fund schemes" />
        <Pagination page={data.page ?? page} size={data.size || SIZE} total={data.total} onChange={(p) => update({ page: p || '' }, false)} />
      </div>
    );

  return (
    <>
      <PageHead eyebrow="Fund explorer" title="Explore mutual fund schemes" lead="Search and compare regular plans across fund houses. Returns are annualised for periods above one year.">
        <p className="small pub-nfo-link">
          Looking for new launches? <Link to="/nfo">See new fund offers (NFOs) open now or opening soon →</Link>
        </p>
      </PageHead>
      <section className="section pub-tight-top">
        <div className="container">
          <form className="pub-filters card" role="search" aria-label="Filter schemes" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
            <Field label="Search schemes" className="pub-filters__search">
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Scheme or AMC name" autoComplete="off" />
            </Field>
            <Field label="Category">
              <Select value={filters.category} onChange={(e) => update({ category: e.target.value })} placeholder="All categories" options={withCurrent(f.categories || [], filters.category).map((c) => ({ value: c, label: humanize(c) }))} />
            </Field>
            <Field label="Sub-category">
              <Select value={filters.subCategory} onChange={(e) => update({ subCategory: e.target.value })} placeholder="All sub-categories" options={withCurrent(f.subCategories || [], filters.subCategory)} />
            </Field>
            <Field label="AMC">
              <Select value={filters.amc} onChange={(e) => update({ amc: e.target.value })} placeholder="All AMCs" options={withCurrent(f.amcs || [], filters.amc)} />
            </Field>
            <Field label="Risk level">
              <Select value={filters.risk} onChange={(e) => update({ risk: e.target.value })} placeholder="All risk levels" options={risks.map((r) => ({ value: r, label: riskLabel(r) }))} />
            </Field>
            <Field label="Sort by">
              <Select value={sort} onChange={(e) => update({ sort: e.target.value })} placeholder="Default" options={SORTS} />
            </Field>
          </form>
          {meta.error && <p className="tiny muted">Filter options could not be loaded; search still works.</p>}
          <div className="row row--between pub-results-bar">
            <p className="small muted" aria-live="polite" style={{ margin: 0 }}>
              {data ? `${data.total} scheme${data.total === 1 ? '' : 's'} found` : ' '}
            </p>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear filters
              </Button>
            )}
          </div>
          {results}
          <p className="tiny muted" style={{ marginTop: '1.5rem' }}>
            All schemes shown are Regular plans distributed under our ARN. Past performance may or may not be sustained in future. Listing a scheme here is not a recommendation.
          </p>
          <StandardDisclaimer compact />
        </div>
      </section>
    </>
  );
}
