import { Link } from 'react-router-dom';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { Accordion, ExtLink, SectionHeading } from '../../components/Misc';
import { ErrorState } from '../../components/States';
import { Skeleton, SkeletonCards } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useSite } from '../../auth/SiteContext';
import { useTitle } from '../../utils/useTitle';
import { formatCr, formatNumber } from '../../utils/format';
import { HOME_FALLBACK, HOME_SERVICE_SLUGS, SERVICE_META, initials, serviceIcon } from './parts/content';
import { AmcStrip } from './parts/Amc';
import ArticleCard from './parts/ArticleCard';
import MiniSip from './parts/MiniSip';
import { NFO_DISCLAIMER, NfoCard } from './parts/Nfo';
import { brand } from '../../brand';
import { STATIC_SITE } from '../../utils/siteMode';
import { LOCAL_FAQS } from '../../seoContent';

const isNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));

function Hero({ hero }) {
  return (
    <section className="pub-hero on-navy" aria-labelledby="hero-title">
      <div className="container pub-hero__grid">
        <div className="pub-hero__copy">
          <span className="eyebrow">AMFI-registered mutual fund distributor</span>
          <h1 id="hero-title">{hero.headline || HOME_FALLBACK.hero.headline}</h1>
          <span className="gold-rule" aria-hidden="true" />
          <p className="lead">{hero.subline || HOME_FALLBACK.hero.subline}</p>
          <div className="row pub-hero__ctas">
            <Button variant="gold" size="lg" to="/contact">
              {hero.primaryCtaLabel || HOME_FALLBACK.hero.primaryCtaLabel}
            </Button>
            <Button variant="outline-gold" size="lg" to="/calculators/sip">
              {hero.secondaryCtaLabel || HOME_FALLBACK.hero.secondaryCtaLabel}
            </Button>
          </div>
          {!STATIC_SITE && (
            <p className="small pub-hero__login">
              Existing client? <Link to="/login">Log in to your account</Link>
            </p>
          )}
          <p className="pub-hero__note tiny">
            Mutual fund investments are subject to market risks, read all scheme related documents carefully. We distribute mutual funds and do not provide
            investment advice.
          </p>
        </div>
        <div className="pub-hero__brand" aria-hidden="true">
          <div className="pub-hero__frame">
            <img src={brand.fullGold} alt="" width="580" height="515" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Banners() {
  const q = useApi(() => publicApi.banners(), []);
  const items = q.data || [];
  if (!items.length) return null;
  return (
    <section className="pub-banners" aria-label="Announcements">
      <div className="container stack">
        {items.map((b) => {
          const internal = b.ctaUrl && b.ctaUrl.startsWith('/');
          return (
            <div key={b.id} className="pub-banner">
              <div>
                <strong className="pub-banner__title">{b.title}</strong>
                {b.text && (
                  <p className="small" style={{ margin: 0 }}>
                    {b.text}
                  </p>
                )}
              </div>
              {b.ctaUrl &&
                b.ctaLabel &&
                (internal ? (
                  <Link className="btn btn--outline btn--sm" to={b.ctaUrl}>
                    {b.ctaLabel}
                  </Link>
                ) : (
                  <ExtLink className="btn btn--outline btn--sm" href={b.ctaUrl}>
                    {b.ctaLabel}
                  </ExtLink>
                ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Trust() {
  const { site } = useSite();
  const s = site.stats;
  if (!s) return null;
  const items = [
    isNum(s.aumCr) && { label: 'Assets under distribution', value: formatCr(s.aumCr, 0) },
    isNum(s.clients) && { label: 'Clients', value: `${formatNumber(s.clients)}+` },
    isNum(s.families) && { label: 'Families served', value: `${formatNumber(s.families)}+` },
    isNum(s.years) && { label: 'Years of experience', value: formatNumber(s.years) },
    isNum(s.sipsRunning) && { label: 'SIPs running', value: formatNumber(s.sipsRunning) },
    isNum(s.sipBookCr) && { label: 'Monthly SIP book', value: formatCr(s.sipBookCr, 2) },
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <section className="pub-stats on-navy" aria-label="Aureus Finserve in numbers">
      <div className="container">
        <dl className="pub-stats__grid" style={{ '--n': items.length }}>
          {items.map((it) => (
            <div key={it.label} className="pub-stats__item">
              <dt>{it.label}</dt>
              <dd className="num">{it.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ServicesBand() {
  const q = useApi(() => publicApi.services(), []);
  const list = q.data || [];
  const cards = HOME_SERVICE_SLUGS.map((slug) => {
    const s = list.find((x) => x.slug === slug);
    const meta = SERVICE_META[slug];
    return { slug, title: s?.title || meta.title, shortText: s?.shortText || meta.short, icon: serviceIcon(s || { slug }) };
  });
  return (
    <section className="section" aria-labelledby="svc-title">
      <div className="container">
        <div className="row row--between" style={{ alignItems: 'flex-end' }}>
          <SectionHeading eyebrow="What we do" title={<span id="svc-title">Solutions for every stage of life</span>} lead="We facilitate investments in regular plans across fund houses and take care of the paperwork, so you can focus on your goals." />
          <Button variant="outline" to="/services" style={{ marginBottom: '2rem' }}>
            All services
          </Button>
        </div>
        {q.loading && !q.data ? (
          <SkeletonCards count={6} height={190} />
        ) : (
          <ul className="pub-svc-grid">
            {cards.map((s) => (
              <li key={s.slug}>
                <Link to={`/services/${s.slug}`} className="pub-svc">
                  <span className="pub-svc__icon">
                    <Icon name={s.icon} size={26} strokeWidth={1.3} />
                  </span>
                  <h3 className="pub-svc__title">{s.title}</h3>
                  <p className="small muted">{s.shortText}</p>
                  <span className="pub-svc__more">
                    Learn more <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function KycBand() {
  return (
    <section className="section section--navy on-navy pub-kyc-band" aria-labelledby="kyc-band-title">
      <div className="container pub-kyc-band__grid">
        <div>
          <span className="eyebrow">Online KYC</span>
          <h2 id="kyc-band-title">Complete your KYC online</h2>
          <span className="gold-rule" aria-hidden="true" />
          <p className="lead">
            KYC is needed once to invest in mutual funds. Fill in your details and upload your documents in about 10 minutes — we handle the
            verification, a short video call and registration with the KRA.
          </p>
          <p className="small pub-kyc-band__need">
            <Icon name="file" size={18} /> <span><strong>What you’ll need:</strong> PAN card, address proof (passport for NRIs), a photo, your signature and your mobile for an OTP.</span>
          </p>
        </div>
        <div className="pub-kyc-band__actions">
          <Link to="/kyc?type=resident" className="pub-kyc-band__btn">
            <span className="pub-kyc-band__icon" aria-hidden="true">
              <Icon name="home" size={24} strokeWidth={1.4} />
            </span>
            <span>
              <strong>I live in India (Resident)</strong>
              <span>PAN + Indian address proof</span>
            </span>
            <span className="pub-kyc-band__arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link to="/kyc?type=nri" className="pub-kyc-band__btn">
            <span className="pub-kyc-band__icon" aria-hidden="true">
              <Icon name="globe" size={24} strokeWidth={1.4} />
            </span>
            <span>
              <strong>I live abroad (NRI)</strong>
              <span>PAN + passport + overseas address proof</span>
            </span>
            <span className="pub-kyc-band__arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <p className="small" style={{ margin: '0.25rem 0 0' }}>
            Already applied? <Link to="/kyc/status">Track your KYC application</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

const WHY_ICONS = ['shield', 'user', 'pie', 'file'];

function WhyBand({ items }) {
  if (!items?.length) return null;
  return (
    <section className="section section--cream" aria-labelledby="why-title">
      <div className="container">
        <SectionHeading center eyebrow="Why Aureus" title={<span id="why-title">Why families choose us</span>} />
        <ul className="pub-why">
          {items.map((w, i) => (
            <li key={w.title} className="pub-why__item">
              <span className="pub-why__icon">
                <Icon name={WHY_ICONS[i % WHY_ICONS.length]} size={24} strokeWidth={1.3} />
              </span>
              <h3>{w.title}</h3>
              <p className="small muted">{w.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowBand({ items }) {
  if (!items?.length) return null;
  return (
    <section className="section" aria-labelledby="how-title">
      <div className="container">
        <SectionHeading center eyebrow="Getting started" title={<span id="how-title">How it works</span>} />
        <ol className="pub-how">
          {items.map((s, i) => (
            <li key={s.title} className="pub-how__step">
              <span className="pub-how__num" aria-hidden="true">
                {String(s.step ?? i + 1).padStart(2, '0')}
              </span>
              <h3>{s.title}</h3>
              <p className="small muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="center" style={{ marginTop: '2rem' }}>
          <Button to="/contact">Talk to us</Button>
        </div>
      </div>
    </section>
  );
}

function CalcBand() {
  return (
    <section className="section section--cream" aria-labelledby="calc-title">
      <div className="container pub-split pub-split--calc">
        <div>
          <SectionHeading eyebrow="Plan ahead" title={<span id="calc-title">See what a monthly habit can grow into</span>} lead="Move the sliders for an illustration of how a SIP might grow. Our goal, step-up, SWP, ELSS and retirement calculators help you plan further." />
          <Button variant="outline" to="/calculators">
            More calculators
          </Button>
        </div>
        <MiniSip />
      </div>
    </section>
  );
}

function AmcBand() {
  const q = useApi(() => publicApi.amcs(), []);
  if (q.error && !q.data) return null;
  const items = q.data || [];
  if (!q.loading && !items.length) return null;
  return (
    <section className="section" aria-labelledby="amc-title">
      <div className="container">
        <div className="row row--between" style={{ alignItems: 'flex-end' }}>
          <SectionHeading eyebrow="Fund houses" title={<span id="amc-title">Our AMC partners</span>} />
          <Button variant="outline" to="/amc-partners" style={{ marginBottom: '2rem' }}>
            View all
          </Button>
        </div>
        {q.loading && !q.data ? <Skeleton height={96} style={{ borderRadius: 8 }} /> : <AmcStrip amcs={items} />}
        <p className="tiny muted" style={{ marginTop: '1rem' }}>
          We are a distributor of these AMCs’ schemes; listing does not imply endorsement.
        </p>
      </div>
    </section>
  );
}

/** Up to 4 open / upcoming NFOs; hidden when there are none (or they cannot be loaded). */
function NfoBand() {
  const q = useApi(() => publicApi.nfos(), []);
  const amcs = useApi(() => publicApi.amcs(), []);
  const items = (q.data || []).slice(0, 4);
  if (!items.length) return null;
  return (
    <section className="section pub-nfo-band" aria-labelledby="nfo-band-title">
      <div className="container">
        <div className="row row--between" style={{ alignItems: 'flex-end' }}>
          <SectionHeading eyebrow="Just launched" title={<span id="nfo-band-title">New fund offers</span>} lead="New schemes open for subscription now or opening soon." />
          <Button variant="outline" to="/nfo" style={{ marginBottom: '2rem' }}>
            View all NFOs
          </Button>
        </div>
        <ul className="pub-nfo-grid pub-nfo-grid--band">
          {items.map((n) => (
            <li key={n.id}>
              <NfoCard nfo={n} amcs={amcs.data} compact />
            </li>
          ))}
        </ul>
        <p className="tiny muted" style={{ marginTop: '1rem' }}>
          {NFO_DISCLAIMER}
        </p>
      </div>
    </section>
  );
}

/** Local search band: who we are and where, with links to the main services and the local FAQs (also in the page's structured data). */
function LocalBand() {
  return (
    <section className="section section--cream" aria-labelledby="local-title">
      <div className="container pub-narrow">
        <span className="eyebrow">Thiruvananthapuram, Kerala</span>
        <h2 id="local-title">Mutual fund and SIP investment in Trivandrum</h2>
        <span className="gold-rule gold-rule--dark" aria-hidden="true" />
        <p>
          Aureus Finserve is an AMFI-registered mutual fund distributor (ARN-372611) based at Pangode, Thirumala in Thiruvananthapuram. We help
          families and professionals across Trivandrum and Kerala, and NRIs abroad, <Link to="/services/sip">start a SIP</Link>,{' '}
          <Link to="/services/lump-sum">invest a lump sum</Link>, <Link to="/services/tax-saving-elss">save tax with ELSS funds</Link>,{' '}
          <Link to="/services/retirement">plan for retirement</Link> and <Link to="/services/child-education">their children’s education</Link>, in
          regular plans of{' '}
          <Link to="/amc-partners">leading mutual fund houses</Link>.
        </p>
        <p>
          Compare schemes in our <Link to="/funds">fund explorer</Link>, try the <Link to="/calculators/sip">SIP calculator</Link>, or{' '}
          <Link to="/contact">book a free consultation</Link> at our office or over a call.
        </p>
        <h3 style={{ marginTop: '2rem' }}>Common questions</h3>
        <Accordion items={LOCAL_FAQS.map((f, i) => ({ id: i, title: f.question, content: <p>{f.answer}</p> }))} />
      </div>
    </section>
  );
}

function Testimonials() {
  const q = useApi(() => publicApi.testimonials(), []);
  let body;
  if (q.loading && !q.data) body = <SkeletonCards count={3} height={180} />;
  else if (q.error && !q.data) body = <ErrorState error={q.error} onRetry={q.reload} title="Client stories could not be loaded" />;
  else {
    const items = (q.data || []).slice(0, 6);
    if (!items.length) return null;
    body = (
      <ul className="pub-quotes">
        {items.map((t, i) => (
          <li key={`${t.name}-${i}`}>
            <figure className="pub-quote">
              <span className="pub-quote__mark" aria-hidden="true">
                “
              </span>
              <blockquote>
                <p>{t.text}</p>
              </blockquote>
              <figcaption className="pub-quote__who">
                {t.photoUrl ? (
                  <img src={t.photoUrl} alt="" className="pub-avatar" width="44" height="44" loading="lazy" />
                ) : (
                  <span className="pub-avatar pub-avatar--initials" aria-hidden="true">
                    {initials(t.name)}
                  </span>
                )}
                <span>
                  <strong>{t.name}</strong>
                  {t.city && <span className="muted small"> · {t.city}</span>}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section className="section section--cream" aria-labelledby="tst-title">
      <div className="container">
        <SectionHeading center eyebrow="In their words" title={<span id="tst-title">Trusted by families</span>} />
        {body}
        <p className="tiny muted center" style={{ marginTop: '1.5rem' }}>
          Testimonials reflect individual service experiences and are not indicative of investment performance.
        </p>
      </div>
    </section>
  );
}

function LatestArticles() {
  const q = useApi(() => publicApi.articles(), []);
  let content;
  if (q.loading && !q.data) {
    content = (
      <div className="grid grid-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={200} style={{ borderRadius: 8 }} />
        ))}
      </div>
    );
  } else if (q.error && !q.data) {
    content = <ErrorState error={q.error} onRetry={q.reload} title="Articles could not be loaded" />;
  } else {
    const items = [...(q.data || [])].sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))).slice(0, 3);
    if (!items.length) return null;
    content = (
      <div className="grid grid-3">
        {items.map((a) => (
          <ArticleCard key={a.id} a={a} />
        ))}
      </div>
    );
  }
  return (
    <section className="section" aria-labelledby="art-title">
      <div className="container">
        <div className="row row--between" style={{ alignItems: 'flex-end' }}>
          <SectionHeading eyebrow="Knowledge centre" title={<span id="art-title">Insights for informed investors</span>} />
          <Button variant="outline" to="/learn" style={{ marginBottom: '2rem' }}>
            View all
          </Button>
        </div>
        {content}
      </div>
    </section>
  );
}

export default function Home() {
  useTitle(null);
  const q = useApi(() => publicApi.home(), []);
  const home = q.data || HOME_FALLBACK;
  const sec = { ...HOME_FALLBACK.sections, ...(q.data?.sections || {}) };
  const why = home.whyChooseUs?.length ? home.whyChooseUs : HOME_FALLBACK.whyChooseUs;
  const how = home.howItWorks?.length ? home.howItWorks : HOME_FALLBACK.howItWorks;
  return (
    <>
      <Hero hero={home.hero || HOME_FALLBACK.hero} />
      <Banners />
      {/* Trust numbers band (AUM, clients, families, years, SIPs, SIP book) hidden for now.
          To show it again, uncomment the next line; the figures come from app.firm.stats / Site settings.
      {sec.trust && <Trust />} */}
      {sec.services && <ServicesBand />}
      {!STATIC_SITE && <KycBand />}
      {sec.why && <WhyBand items={why} />}
      {sec.how && <HowBand items={how} />}
      {sec.calculator && <CalcBand />}
      {sec.amcs && <AmcBand />}
      <NfoBand />
      {sec.testimonials && <Testimonials />}
      {sec.articles && <LatestArticles />}
      <LocalBand />
    </>
  );
}
