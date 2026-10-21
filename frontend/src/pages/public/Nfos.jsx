import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import Tabs from '../../components/Tabs';
import { Field, Input, Select } from '../../components/Field';
import { PageHead, StandardDisclaimer } from '../../components/Misc';
import { EmptyState, ErrorState } from '../../components/States';
import { SkeletonCards } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useTitle } from '../../utils/useTitle';
import { NFO_CATEGORIES, NFO_DISCLAIMER, NfoCard } from './parts/Nfo';

const TABS = [
  { id: 'open', label: 'Open now' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'closed', label: 'Recently closed' },
];

const EMPTY = {
  open: { title: 'No NFOs are open right now', text: 'New fund offers open every few days. Check the upcoming ones, or ask us to tell you when a fund you are interested in launches.' },
  upcoming: { title: 'No upcoming NFOs announced yet', text: 'Fund houses usually announce an NFO a few days before it opens. Check back soon.' },
  closed: { title: 'No NFOs closed in the last 30 days', text: 'NFOs that closed recently are listed here for 30 days.' },
};

export default function Nfos() {
  useTitle('New fund offers');
  const [sp, setSp] = useSearchParams();
  const tab = TABS.some((t) => t.id === sp.get('tab')) ? sp.get('tab') : 'open';
  const amc = sp.get('amc') || '';
  const cat = sp.get('category') || '';
  const qParam = sp.get('q') || '';
  const [search, setSearch] = useState(qParam);

  const update = (patch) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, String(v))));
    setSp(next, { replace: true });
  };
  useEffect(() => setSearch(qParam), [qParam]);
  useEffect(() => {
    if (search.trim() === qParam) return undefined;
    const t = setTimeout(() => update({ q: search.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // every NFO on the public site (tab counts + AMC options), and the filtered list for the current tab
  const all = useApi(() => publicApi.nfos({ status: 'all' }), []);
  const list = useApi(() => publicApi.nfos({ status: tab, amc, assetClass: cat, q: qParam }), [tab, amc, cat, qParam]);
  const amcs = useApi(() => publicApi.amcs(), []);

  const counts = { open: 0, upcoming: 0, closed: 0 };
  (all.data || []).forEach((n) => {
    counts[n.status.toLowerCase()] = (counts[n.status.toLowerCase()] || 0) + 1;
  });
  const amcOptions = [...new Set((all.data || []).map((n) => n.amc))].sort((a, b) => a.localeCompare(b));
  if (amc && !amcOptions.includes(amc)) amcOptions.unshift(amc);
  const tabs = TABS.map((t) => ({ ...t, badge: all.data && counts[t.id] ? counts[t.id] : null }));
  const hasFilters = amc || cat || qParam;
  const clear = () => {
    setSearch('');
    update({ amc: '', category: '', q: '' });
  };

  let body;
  if (list.loading && !list.data) body = <SkeletonCards count={3} height={260} />;
  else if (list.error && !list.data) body = <ErrorState error={list.error} onRetry={list.reload} title="New fund offers could not be loaded" />;
  else if (!list.data?.length) {
    const e = EMPTY[tab];
    body = hasFilters ? (
      <EmptyState title="No NFOs match your filters" icon="search" action={<Button variant="outline" onClick={clear}>Clear filters</Button>}>
        Try another fund house or category.
      </EmptyState>
    ) : (
      <EmptyState
        title={e.title}
        icon="briefcase"
        action={
          tab === 'open' && counts.upcoming ? (
            <Button variant="outline" onClick={() => update({ tab: 'upcoming' })}>
              See upcoming NFOs
            </Button>
          ) : (
            <Button variant="outline" to="/contact?interest=OTHER">
              Talk to us
            </Button>
          )
        }
      >
        {e.text}
      </EmptyState>
    );
  } else {
    body = (
      <ul className={`pub-nfo-grid ${list.loading ? 'pub-loading' : ''}`} aria-busy={list.loading || undefined}>
        {list.data.map((n) => (
          <li key={n.id}>
            <NfoCard nfo={n} amcs={amcs.data} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Invest"
        title="New fund offers"
        lead="New schemes from fund houses that are open for subscription now or opening soon. We can help you decide whether an NFO fits your goals and invest in its regular plan."
      />
      <section className="section pub-tight-top">
        <div className="container stack-lg">
          <Tabs tabs={tabs} value={tab} onChange={(id) => update({ tab: id === 'open' ? '' : id })} label="New fund offers by status" />
          <form className="pub-filters pub-nfo-filters card" role="search" aria-label="Filter new fund offers" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
            <Field label="Search" className="pub-filters__search">
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Scheme or fund house" autoComplete="off" />
            </Field>
            <Field label="Fund house (AMC)">
              <Select value={amc} onChange={(e) => update({ amc: e.target.value })} placeholder="All fund houses" options={amcOptions} />
            </Field>
            <Field label="Category">
              <Select value={cat} onChange={(e) => update({ category: e.target.value })} placeholder="All categories" options={NFO_CATEGORIES} />
            </Field>
          </form>
          <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab).label} className="stack">
            <div className="row row--between">
              <p className="small muted" aria-live="polite" style={{ margin: 0 }}>
                {list.data ? `${list.data.length} NFO${list.data.length === 1 ? '' : 's'}` : ' '}
              </p>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clear}>
                  Clear filters
                </Button>
              )}
            </div>
            {body}
          </div>
          <div className="pub-nfo-note card card--accent">
            <p style={{ margin: 0 }}>
              <strong>{NFO_DISCLAIMER}</strong>
            </p>
            <p className="small muted" style={{ margin: '0.5rem 0 0' }}>
              Dates are from AMFI and the fund houses. Where a fund house has not published the closing date yet, we show the latest possible date — SEBI allows an NFO to stay open for at most 15 days (ELSS excepted). Listing an NFO is not a recommendation. Looking for existing schemes? Use the <Link to="/funds">fund explorer</Link>.
            </p>
          </div>
          <StandardDisclaimer compact />
        </div>
      </section>
    </>
  );
}
