import { Link } from 'react-router-dom';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { PageHead, SectionHeading, StandardDisclaimer } from '../../components/Misc';
import { Async, EmptyState } from '../../components/States';
import { SkeletonCards } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useTitle } from '../../utils/useTitle';
import { SERVICE_META, serviceIcon } from './parts/content';
import { STATIC_SITE } from '../../utils/siteMode';

const PRINCIPLES = [
  { icon: 'users', title: 'You decide', text: 'We explain options, costs and risks clearly. Investment decisions are always yours.' },
  { icon: 'file', title: 'Full disclosure', text: 'We distribute regular plans and disclose the trail commission we receive on every scheme page.' },
  { icon: 'shield', title: 'Secure and paperless', text: 'Online KYC, mandates and exchange-based transactions with OTP verification.' },
];

export default function Services() {
  useTitle('Services');
  const q = useApi(() => publicApi.services(), []);
  return (
    <>
      <PageHead eyebrow="Services" title="How we can help" lead="As an AMFI-registered mutual fund distributor, we facilitate investments across fund houses, help with documentation, and service your folios for the long term." />
      <section className="section">
        <div className="container">
          <Async state={q} empty={(d) => !d.length} emptyView={<EmptyState title="Services will be listed here soon" />} skeleton={<SkeletonCards count={8} height={200} />}>
            {(list) => (
              <ul className="pub-svc-grid pub-svc-grid--4">
                {list.map((s) => (
                  <li key={s.slug}>
                    <Link to={`/services/${s.slug}`} className="pub-svc">
                      <span className="pub-svc__icon">
                        <Icon name={serviceIcon(s)} size={26} strokeWidth={1.3} />
                      </span>
                      <h2 className="pub-svc__title">{s.title || SERVICE_META[s.slug]?.title}</h2>
                      <p className="small muted">{s.shortText || SERVICE_META[s.slug]?.short}</p>
                      <span className="pub-svc__more">
                        Learn more <span aria-hidden="true">→</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Async>
          {!STATIC_SITE && (
          <div className="pub-related" style={{ marginTop: '2rem' }}>
            <div>
              <h2 className="pub-h3">New to mutual funds? Complete your KYC online</h2>
              <p className="small muted" style={{ margin: 0 }}>
                KYC is needed once before you invest. Residents and NRIs can apply online in about 10 minutes; we handle the verification and KRA registration.
              </p>
            </div>
            <div className="row">
              <Button to="/kyc?type=resident">Resident KYC</Button>
              <Button variant="outline" to="/kyc?type=nri">
                NRI KYC
              </Button>
            </div>
          </div>
          )}
        </div>
      </section>
      <section className="section section--cream" aria-labelledby="principles-title">
        <div className="container">
          <SectionHeading center eyebrow="Our approach" title={<span id="principles-title">A distributor’s role, done well</span>} />
          <ul className="pub-why pub-why--3">
            {PRINCIPLES.map((p) => (
              <li key={p.title} className="pub-why__item">
                <span className="pub-why__icon">
                  <Icon name={p.icon} size={24} strokeWidth={1.3} />
                </span>
                <h3>{p.title}</h3>
                <p className="small muted">{p.text}</p>
              </li>
            ))}
          </ul>
          <div className="center" style={{ marginTop: '2.5rem' }}>
            <Button to="/contact">Book a call</Button>
          </div>
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
