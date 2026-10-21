import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '../../components/Button';
import Tabs from '../../components/Tabs';
import { Accordion, PageHead, StandardDisclaimer } from '../../components/Misc';
import { ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useTitle } from '../../utils/useTitle';
import { humanize } from '../../utils/format';
import { SERVICE_META } from './parts/content';
import { calculatorById } from './parts/calculators/registry';
import RichText from './parts/RichText';
import NotFoundBlock from './parts/NotFoundBlock';
import PortfolioReviewForm from './parts/PortfolioReviewForm';
import { StaticReviewPanel } from '../../static/StaticContact';
import { STATIC_SITE } from '../../utils/siteMode';

function EmbeddedCalculators({ ids }) {
  const calcs = (ids || []).map(calculatorById).filter(Boolean);
  const [active, setActive] = useState(calcs[0]?.id);
  if (!calcs.length) return null;
  const current = calcs.find((c) => c.id === active) || calcs[0];
  const C = current.Component;
  return (
    <section className="section section--cream" aria-labelledby="svc-calc">
      <div className="container">
        <span className="eyebrow">Plan with numbers</span>
        <h2 id="svc-calc">Try the calculator</h2>
        <span className="gold-rule gold-rule--dark" aria-hidden="true" />
        {calcs.length > 1 && <Tabs tabs={calcs.map((c) => ({ id: c.id, label: c.label }))} value={current.id} onChange={setActive} label="Calculators" />}
        <div role={calcs.length > 1 ? 'tabpanel' : undefined}>
          <C key={current.id} headingLevel={3} />
        </div>
      </div>
    </section>
  );
}

export default function ServiceDetail() {
  const { slug } = useParams();
  const q = useApi(() => publicApi.service(slug), [slug]);
  const s = q.data;
  const meta = SERVICE_META[slug] || {};
  useTitle(s?.title || meta.title || 'Service');

  if (q.error && q.error.status === 404) {
    return <NotFoundBlock title="Service not found" message="We couldn’t find that service. Please browse all our services." backTo="/services" backLabel="All services" />;
  }
  if (q.loading && !s) {
    return (
      <>
        <PageHead eyebrow="Services" title={meta.title || 'Loading…'} />
        <section className="section">
          <div className="container">
            <SkeletonBlock rows={6} />
          </div>
        </section>
      </>
    );
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

  const isReview = slug === 'portfolio-review';
  const interest = meta.interest || 'OTHER';
  const subs = s.relatedSubCategories || [];
  const hasRelated = s.relatedCategory || subs.length > 0;

  return (
    <>
      <PageHead eyebrow="Services" title={s.title} lead={s.shortText}>
        <div className="row" style={{ marginTop: '1.5rem' }}>
          <Button variant="gold" to={`/contact?interest=${interest}`}>
            Book a call
          </Button>
          <Button variant="outline-gold" to="/services">
            All services
          </Button>
        </div>
      </PageHead>

      <section className="section">
        <div className="container pub-detail-grid">
          <div>
            <span className="eyebrow">Overview</span>
            <h2>What it is</h2>
            <span className="gold-rule gold-rule--dark" aria-hidden="true" />
            <RichText body={s.whatItIs} headingLevel={3} />
          </div>
          <aside className="card card--accent pub-suits" aria-labelledby="suits-title">
            <h2 id="suits-title" className="card__title">
              Who it suits
            </h2>
            <RichText body={s.whoItSuits} headingLevel={3} />
          </aside>
        </div>
      </section>

      {s.howItWorks?.length > 0 && (
        <section className={`section ${isReview ? 'section--cream' : ''} pub-band-line`} aria-labelledby="how-svc">
          <div className="container">
            <span className="eyebrow">The process</span>
            <h2 id="how-svc">How it works</h2>
            <span className="gold-rule gold-rule--dark" aria-hidden="true" />
            <ol className="pub-steps">
              {s.howItWorks.map((step, i) => (
                <li key={i}>
                  <span className="pub-steps__num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {hasRelated && (
        <section className="section pub-tight" aria-labelledby="rel-title">
          <div className="container">
            <div className="pub-related">
              <div>
                <h2 id="rel-title" className="pub-h3">
                  Related fund categories
                </h2>
                <p className="small muted" style={{ margin: 0 }}>
                  Browse schemes in the fund explorer. Listing is for information and is not a recommendation.
                </p>
              </div>
              <ul className="pub-chiplinks">
                {s.relatedCategory && (
                  <li>
                    <Link to={`/funds?category=${encodeURIComponent(s.relatedCategory)}`}>All {humanize(s.relatedCategory)} funds</Link>
                  </li>
                )}
                {subs.map((sc) => (
                  <li key={sc}>
                    <Link to={`/funds?${new URLSearchParams({ ...(s.relatedCategory ? { category: s.relatedCategory } : {}), subCategory: sc })}`}>{sc}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {isReview ? (
        <section className="section section--cream" aria-label="Portfolio review request">
          <div className="container pub-narrow">
            {STATIC_SITE ? <StaticReviewPanel /> : <PortfolioReviewForm />}
          </div>
        </section>
      ) : (
        <EmbeddedCalculators key={slug} ids={s.calculators} />
      )}

      {s.faqs?.length > 0 && (
        <section className="section" aria-labelledby="faq-svc">
          <div className="container pub-narrow">
            <span className="eyebrow">Questions</span>
            <h2 id="faq-svc">Frequently asked questions</h2>
            <span className="gold-rule gold-rule--dark" aria-hidden="true" />
            <Accordion items={s.faqs.map((f, i) => ({ id: i, title: f.question, content: <RichText body={f.answer} /> }))} />
          </div>
        </section>
      )}

      <section className="pub-cta on-navy" aria-labelledby="svc-cta">
        <div className="container center">
          <span className="eyebrow">Next step</span>
          <h2 id="svc-cta">Talk to us about {s.title?.toLowerCase()}</h2>
          <span className="gold-rule gold-rule--center" aria-hidden="true" />
          <p className="lead" style={{ margin: '0 auto 2rem' }}>
            {STATIC_SITE ? 'Call or WhatsApp us — we usually reply within a working day.' : 'Share a few details and our team will call you back at a convenient time.'}
          </p>
          <Button variant="gold" size="lg" to={`/contact?interest=${interest}`}>
            {STATIC_SITE ? 'Contact us' : 'Send an enquiry'}
          </Button>
        </div>
      </section>

      <section className="section pub-tight">
        <div className="container">
          <StandardDisclaimer />
        </div>
      </section>
    </>
  );
}
