import { Link, useParams } from 'react-router-dom';
import Button from '../../components/Button';
import { ExtLink, StandardDisclaimer } from '../../components/Misc';
import RiskOMeter from '../../components/RiskOMeter';
import { ErrorState } from '../../components/States';
import { SkeletonBlock, SkeletonCards } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useTitle } from '../../utils/useTitle';
import { formatDate, formatDateTime, formatINR } from '../../utils/format';
import NotFoundBlock from './parts/NotFoundBlock';
import { NFO_DISCLAIMER, NfoAmcMark, NfoCloseDate, NfoStatusBadge, OnePagerButton, nfoCategoryLabel, nfoContactUrl, nfoMinimum, nfoStatusText } from './parts/Nfo';

export default function NfoDetail() {
  const { id } = useParams();
  const q = useApi(() => publicApi.nfo(id), [id]);
  const amcs = useApi(() => publicApi.amcs(), []);
  const n = q.data;
  useTitle(n ? `${n.schemeName} (NFO)` : 'New fund offer');

  if (q.error && (q.error.status === 404 || q.error.code === 'NOT_FOUND')) {
    return <NotFoundBlock title="NFO not found" message="This new fund offer is no longer listed. See the NFOs that are open now or opening soon." backTo="/nfo" backLabel="New fund offers" />;
  }
  if (q.error && !n) {
    return (
      <section className="section">
        <div className="container">
          <ErrorState error={q.error} onRetry={q.reload} />
        </div>
      </section>
    );
  }
  if (!n) {
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
          </div>
        </section>
      </>
    );
  }

  const facts = [
    ['Fund house', n.amc],
    ['Category', [nfoCategoryLabel(n.assetClass), n.subCategory].filter(Boolean).join(' · ')],
    ['AMFI category', n.amfiCategory || '—'],
    ['Scheme type', n.schemeType || '—'],
    ['Minimum investment', nfoMinimum(n)],
    ['Benchmark', n.benchmark || '—'],
    ['Fund managers', n.fundManagers || '—'],
    ['AMFI scheme code', n.schemeCode || '—'],
    ['Minimum amount (as listed)', n.minAmountText || '—', true],
    ['Exit load', n.exitLoad || '—', true],
  ];
  const closed = n.status === 'CLOSED';

  return (
    <>
      <header className="page-head on-navy pub-scheme-head">
        <div className="container">
          <nav aria-label="Breadcrumb" className="pub-crumbs tiny">
            <Link to="/nfo">New fund offers</Link> <span aria-hidden="true">/</span> <span aria-current="page">{n.amc}</span>
          </nav>
          <div className="pub-scheme-head__grid">
            <div>
              <div className="pub-nfo-head__amc">
                <NfoAmcMark amc={n.amc} amcs={amcs.data} />
                <span className="eyebrow" style={{ margin: 0 }}>
                  New fund offer · {n.amc}
                </span>
              </div>
              <h1 className="pub-scheme-title">{n.schemeName}</h1>
              <div className="row" style={{ marginTop: '0.75rem' }}>
                <NfoStatusBadge nfo={n} />
                <span className="chip chip--navy">{nfoCategoryLabel(n.assetClass)}</span>
                {n.subCategory && <span className="chip chip--navy">{n.subCategory}</span>}
              </div>
            </div>
            <div className="pub-scheme-nav pub-nfo-when">
              <span className="pub-scheme-nav__label">{closed ? 'Status' : n.status === 'UPCOMING' ? 'Opens' : 'Closing'}</span>
              <span className="pub-nfo-when__value">{nfoStatusText(n)}</span>
              {!closed && (
                <span className="tiny">
                  {n.status === 'UPCOMING' ? <>Closes on or before {formatDate(n.closesBy)}</> : <>Close date: <NfoCloseDate nfo={n} /></>}
                </span>
              )}
            </div>
          </div>
          <div className="row" style={{ marginTop: '1.5rem' }}>
            {!closed && (
              <Button variant="gold" size="lg" to={nfoContactUrl(n)}>
                Talk to us about this NFO
              </Button>
            )}
            <OnePagerButton nfo={n} variant="outline-gold" size="lg" />
          </div>
        </div>
      </header>

      <section className="section pub-tight-top">
        <div className="container stack-lg">
          <ul className="pub-returns pub-nfo-dates" aria-label="Offer dates">
            <li className="card">
              <span className="stat__label">NFO opens</span>
              <span className="pub-returns__value">{formatDate(n.openDate)}</span>
            </li>
            <li className="card">
              <span className="stat__label">NFO closes</span>
              <span className="pub-returns__value">{n.closeDateConfirmed ? formatDate(n.closeDate) : formatDate(n.closesBy)}</span>
              <span className="tiny muted">{n.closeDateConfirmed ? 'As published' : 'On or before (max 15 days)'}</span>
            </li>
            <li className="card">
              <span className="stat__label">Minimum investment</span>
              <span className="pub-returns__value">{n.minAmount != null && Number(n.minAmount) > 0 ? formatINR(n.minAmount, { decimals: 0 }) : '—'}</span>
              <span className="tiny muted">During the NFO</span>
            </li>
            <li className="card">
              <span className="stat__label">Status</span>
              <span className="pub-returns__value pub-nfo-dates__status">{closed ? 'Closed' : n.status === 'OPEN' ? 'Open now' : 'Upcoming'}</span>
            </li>
          </ul>

          <div className="pub-scheme-grid">
            <div className="stack-lg">
              {n.objective && (
                <section className="card" aria-labelledby="nfo-obj-h">
                  <h2 id="nfo-obj-h" className="card__title">
                    Investment objective
                  </h2>
                  <p style={{ margin: 0 }}>{n.objective}</p>
                </section>
              )}
              <section className="card" aria-labelledby="nfo-facts-h">
                <h2 id="nfo-facts-h" className="card__title">
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
              <section className="card card--accent" aria-labelledby="nfo-what-h">
                <h2 id="nfo-what-h" className="card__title">
                  Before you invest in an NFO
                </h2>
                <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  <li>An NFO has no track record — judge it on its strategy, the fund manager and how it fits your portfolio, not on the ₹10 launch price.</li>
                  <li>Units are allotted after the offer closes; open-ended schemes reopen for purchase and redemption within a few business days.</li>
                  <li>Read the Scheme Information Document (SID) and Key Information Memorandum for costs, risks and exit load.</li>
                </ul>
              </section>
            </div>
            <aside className="stack-lg">
              <section className="card pub-risk-card" aria-labelledby="nfo-risk-h">
                <h2 id="nfo-risk-h" className="card__title">
                  Riskometer
                </h2>
                {n.riskometer ? (
                  <RiskOMeter risk={n.riskometer} sidUrl={n.sidUrl} schemeName={n.schemeName} size={240} />
                ) : (
                  <p className="small muted" style={{ margin: 0 }}>
                    The fund house has not published the risk-o-meter for this scheme yet. It is in the scheme information document.
                  </p>
                )}
              </section>
              <section className="card card--accent" aria-labelledby="nfo-docs-h">
                <h2 id="nfo-docs-h" className="card__title">
                  Scheme documents
                </h2>
                <ul className="pub-doclinks">
                  {n.sidUrl && (
                    <li>
                      <ExtLink href={n.sidUrl}>Scheme Information Document (SID)</ExtLink>
                    </li>
                  )}
                  {n.hasOnePager && (
                    <li>
                      <OnePagerButton nfo={n} variant="link" label="NFO one-pager (PDF)" />
                      {n.onePagerUpdatedAt && <span className="tiny muted"> · updated {formatDateTime(n.onePagerUpdatedAt)}</span>}
                    </li>
                  )}
                  {!n.sidUrl && !n.hasOnePager && <li className="muted small">The SID and NFO leaflet are available on the fund house’s website.</li>}
                </ul>
              </section>
              <section className="card card--navy" aria-labelledby="nfo-cta-h">
                <h2 id="nfo-cta-h" className="card__title">
                  {closed ? 'Looking for similar funds?' : 'Interested in this NFO?'}
                </h2>
                <p className="small">
                  {closed
                    ? 'This offer has closed. Talk to us about existing schemes with a track record in the same category.'
                    : 'Talk to our team about whether it suits your goals. We can help you complete KYC and invest in the regular plan.'}
                </p>
                <Button variant="gold" to={closed ? '/contact?interest=OTHER' : nfoContactUrl(n)}>
                  Talk to us
                </Button>
              </section>
            </aside>
          </div>
          <div className="pub-nfo-note card">
            <p style={{ margin: 0 }}>
              <strong>{NFO_DISCLAIMER}</strong>
            </p>
            <p className="tiny muted" style={{ margin: '0.5rem 0 0' }}>
              Dates and details are from AMFI and the fund house’s Scheme Summary Document; they can change. Listing an NFO is not a recommendation.
            </p>
          </div>
          <p>
            <Link to="/nfo">← All new fund offers</Link>
          </p>
          <StandardDisclaimer />
        </div>
      </section>
    </>
  );
}
