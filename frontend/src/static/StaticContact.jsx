// Static site only: contact panels shown instead of the enquiry / portfolio-review forms (which need the backend).
import { useSearchParams } from 'react-router-dom';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { PageHead } from '../components/Misc';
import { useSite } from '../auth/SiteContext';
import { useTitle } from '../utils/useTitle';
import { PhoneLinks, firstPhone, splitPhones, telHref } from '../utils/phone';
import { interestLabel } from '../pages/public/parts/content';

/** wa.me link for the first number of a phone field, optionally with a prefilled message. */
export function waHref(num, text) {
  let d = String(firstPhone(num) || num || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) d = `91${d}`;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Call / WhatsApp / e-mail buttons. */
function ContactButtons({ site, message, mailSubject }) {
  const phones = splitPhones(site.phone);
  const wa = waHref(site.whatsapp || site.phone, message);
  const mail = site.email ? `mailto:${site.email}${mailSubject ? `?subject=${encodeURIComponent(mailSubject)}` : ''}` : null;
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
      {wa && (
        <Button variant="gold" href={wa} target="_blank" rel="noopener noreferrer">
          <Icon name="chat" size={18} /> WhatsApp us<span className="sr-only"> (opens in new tab)</span>
        </Button>
      )}
      {phones.map((p) => (
        <Button key={p} variant="outline" href={telHref(p)}>
          <Icon name="phone" size={18} /> Call {p}
        </Button>
      ))}
      {mail && (
        <Button variant="ghost" href={mail}>
          <Icon name="mail" size={18} /> E-mail us
        </Button>
      )}
    </div>
  );
}

function Details({ site }) {
  return (
    <aside className="pub-contact-side stack-lg" aria-label="Contact details">
      <div className="card card--navy">
        <span className="eyebrow">Reach us directly</span>
        <ul className="pub-contact-list">
          {site.phone && (
            <li>
              <Icon name="phone" size={18} />
              <span>
                <PhoneLinks value={site.phone} />
              </span>
            </li>
          )}
          {waHref(site.whatsapp || site.phone) && (
            <li>
              <Icon name="chat" size={18} />
              <a href={waHref(site.whatsapp || site.phone)} target="_blank" rel="noopener noreferrer">
                WhatsApp {firstPhone(site.whatsapp || site.phone)}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </li>
          )}
          {site.email && (
            <li>
              <Icon name="mail" size={18} />
              <a href={`mailto:${site.email}`} className="pub-break">
                {site.email}
              </a>
            </li>
          )}
          {site.address && (
            <li>
              <Icon name="pin" size={18} />
              <span style={{ whiteSpace: 'pre-line' }}>{site.address}</span>
            </li>
          )}
          {site.officeHours && (
            <li>
              <Icon name="clock" size={18} />
              <span style={{ whiteSpace: 'pre-line' }}>{site.officeHours}</span>
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}

/** /contact in the static build: no form, just the ways to reach us (+ a suggested WhatsApp message from ?message=). */
export function StaticContactPage() {
  useTitle('Contact us');
  const { site } = useSite();
  const [sp] = useSearchParams();
  const interest = sp.get('interest');
  const message =
    (sp.get('message') || '').slice(0, 1000).trim() || (interest && interest !== 'OTHER' ? `Hello, I'd like to discuss: ${interestLabel(interest)}.` : '');
  return (
    <>
      <PageHead eyebrow="Contact" title="Talk to our team" lead="Call or WhatsApp us — we usually reply within a working day." />
      <section className="section">
        <div className="container pub-contact">
          <div className="stack-lg">
            <div className="card pub-form-card">
              <h2 className="card__title">Call, WhatsApp or e-mail us</h2>
              <p>
                Whether you are starting your first SIP, reviewing an existing portfolio or have a question about a fund, our team is happy to help. Call or
                WhatsApp us — we usually reply within a working day.
              </p>
              {message && (
                <div className="card card--accent" style={{ margin: '1rem 0' }}>
                  <p className="small muted" style={{ margin: 0 }}>
                    Suggested WhatsApp message
                  </p>
                  <p style={{ margin: '0.35rem 0 0', overflowWrap: 'anywhere' }}>
                    <strong>{message}</strong>
                  </p>
                </div>
              )}
              <ContactButtons site={site} message={message} mailSubject={message ? message.slice(0, 120) : 'Enquiry from the website'} />
              <p className="tiny muted" style={{ marginTop: '1rem', marginBottom: 0 }}>
                We are a mutual fund distributor and do not provide investment advice. Please do not share passwords or OTPs with anyone.
              </p>
            </div>
            {site.mapEmbedUrl && (
              <div className="pub-map">
                <iframe src={site.mapEmbedUrl} title="Map showing the Aureus Finserve office" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            )}
          </div>
          <Details site={site} />
        </div>
      </section>
    </>
  );
}

/** Portfolio-review service page in the static build: send the CAS on WhatsApp / e-mail instead of uploading it. */
export function StaticReviewPanel() {
  const { site } = useSite();
  return (
    <div className="card pub-form-card">
      <h2 className="card__title">Send us your CAS on WhatsApp or e-mail</h2>
      <p>
        Download your Consolidated Account Statement (CAS) from CAMS, KFintech, NSDL or CDSL and send it to us on WhatsApp or by e-mail, with the PDF
        password in a separate message. We will review your portfolio and get back to you, usually within a working day.
      </p>
      <ContactButtons site={site} message="Hello, I'd like a free portfolio review. I'll share my CAS statement here." mailSubject="Free portfolio review – my CAS statement" />
    </div>
  );
}
