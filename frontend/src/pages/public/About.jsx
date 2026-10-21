import Button from '../../components/Button';
import { PageHead, SectionHeading } from '../../components/Misc';
import { Async, EmptyState, ErrorState } from '../../components/States';
import { SkeletonBlock, SkeletonCards } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useSite } from '../../auth/SiteContext';
import { useTitle } from '../../utils/useTitle';
import { formatDate } from '../../utils/format';
import { initials } from './parts/content';
import RichText from './parts/RichText';
import { PhoneLinks } from '../../utils/phone';

const arnText = (arn) => `ARN-${String(arn).replace(/^ARN-?/i, '')}`;

function Avatar({ person, size = 'md' }) {
  return person.photoUrl ? (
    <img src={person.photoUrl} alt={`Photo of ${person.name}`} className={`pub-person__photo pub-person__photo--${size}`} loading="lazy" />
  ) : (
    <span className={`pub-person__photo pub-person__photo--${size} pub-person__initials`} aria-hidden="true">
      {initials(person.name)}
    </span>
  );
}

function PersonMeta({ p }) {
  return (
    <dl className="pub-meta">
      {p.qualifications && (
        <div>
          <dt>Qualifications</dt>
          <dd>{p.qualifications}</dd>
        </div>
      )}
      {p.yearsExperience != null && (
        <div>
          <dt>Experience</dt>
          <dd>{p.yearsExperience}+ years</dd>
        </div>
      )}
      {p.euin && (
        <div>
          <dt>EUIN</dt>
          <dd className="num">{p.euin}</dd>
        </div>
      )}
    </dl>
  );
}

function Team() {
  const q = useApi(() => publicApi.team(), []);
  return (
    <section className="section" aria-labelledby="team-title">
      <div className="container">
        <SectionHeading eyebrow="People" title={<span id="team-title">Founder</span>} />
        <Async state={q} empty={(d) => !d.length} emptyView={<EmptyState title="Team profiles coming soon" icon="users" />} skeleton={<SkeletonCards count={3} height={220} />}>
          {(team) => {
            const founder = team.find((t) => t.isFounder);
            const rest = team.filter((t) => t !== founder);
            return (
              <div className="stack-lg">
                {founder && (
                  <article className="pub-founder">
                    <Avatar person={founder} size="lg" />
                    <div>
                      {!/^founder/i.test(founder.designation || '') && <span className="eyebrow">Founder</span>}
                      <h3 className="pub-founder__name">{founder.name}</h3>
                      <p className="pub-person__role">{founder.designation}</p>
                      <PersonMeta p={founder} />
                      {founder.bio && <RichText body={founder.bio} headingLevel={4} />}
                    </div>
                  </article>
                )}
                {/* a single team member gets the same full-width card as the founder instead of one narrow card */}
                {rest.length === 1 && (
                  <article className="pub-founder">
                    <Avatar person={rest[0]} size="lg" />
                    <div>
                      <h3 className="pub-founder__name">{rest[0].name}</h3>
                      <p className="pub-person__role">{rest[0].designation}</p>
                      <PersonMeta p={rest[0]} />
                      {rest[0].bio && <RichText body={rest[0].bio} headingLevel={4} />}
                    </div>
                  </article>
                )}
                {rest.length > 1 && (
                  <ul className="pub-team">
                    {rest.map((p) => (
                      <li key={`${p.name}-${p.euin || ''}`} className="pub-person card">
                        <Avatar person={p} />
                        <h3 className="pub-person__name">{p.name}</h3>
                        <p className="pub-person__role">{p.designation}</p>
                        <PersonMeta p={p} />
                        {p.bio && <p className="small muted">{p.bio}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }}
        </Async>
      </div>
    </section>
  );
}

function Credentials() {
  const { site } = useSite();
  const euins = site.euins || [];
  return (
    <section className="section section--cream" aria-labelledby="cred-title">
      <div className="container">
        <SectionHeading eyebrow="Credentials" title={<span id="cred-title">Registration and disclosures</span>} />
        <div className="grid grid-3">
          <div className="card card--accent">
            <h3 className="card__title">AMFI registration</h3>
            <dl className="pub-meta pub-meta--stack">
              <div>
                <dt>ARN</dt>
                <dd className="num">{site.arn ? arnText(site.arn) : '—'}</dd>
              </div>
              {site.arnValidTill && (
                <div>
                  <dt>Valid till</dt>
                  <dd>{formatDate(site.arnValidTill)}</dd>
                </div>
              )}
              {site.stats?.years != null && (
                <div>
                  <dt>Years in business</dt>
                  <dd>{site.stats.years}</dd>
                </div>
              )}
            </dl>
            <p className="tiny muted" style={{ margin: '1rem 0 0' }}>
              We are a mutual fund distributor and do not provide investment advice.
            </p>
          </div>
          <div className="card card--accent">
            <h3 className="card__title">Employee codes (EUIN)</h3>
            {euins.length ? (
              <ul className="pub-euins">
                {euins.map((e) => (
                  <li key={e.euin}>
                    <span>{e.name}</span>
                    <span className="num">{e.euin}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">EUIN details are shown on each team profile.</p>
            )}
          </div>
          <div className="card card--accent">
            <h3 className="card__title">Commission disclosure</h3>
            <p className="small">We distribute regular plans and receive trail commission from AMCs. Scheme-wise rates are shown on every scheme page.</p>
            <Button variant="link" to="/legal/commission">
              Read the disclosure
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Office({ about }) {
  const { site } = useSite();
  const address = about?.officeAddress || site.address;
  const hours = about?.officeHours || site.officeHours;
  const map = about?.mapEmbedUrl || site.mapEmbedUrl;
  return (
    <section className="section" aria-labelledby="office-title">
      <div className="container pub-detail-grid">
        <div>
          <SectionHeading eyebrow="Visit us" title={<span id="office-title">Our office</span>} />
          <dl className="pub-meta pub-meta--stack">
            {address && (
              <div>
                <dt>Address</dt>
                <dd style={{ whiteSpace: 'pre-line' }}>{address}</dd>
              </div>
            )}
            {hours && (
              <div>
                <dt>Office hours</dt>
                <dd style={{ whiteSpace: 'pre-line' }}>{hours}</dd>
              </div>
            )}
            {site.phone && (
              <div>
                <dt>Phone</dt>
                <dd>
                  <PhoneLinks value={site.phone} />
                </dd>
              </div>
            )}
            {site.email && (
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${site.email}`}>{site.email}</a>
                </dd>
              </div>
            )}
          </dl>
          <Button to="/contact" style={{ marginTop: '1.5rem' }}>
            Book a call
          </Button>
        </div>
        {map ? (
          <div className="pub-map">
            <iframe src={map} title="Map showing the Aureus Finserve office" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function About() {
  useTitle('About us');
  const q = useApi(() => publicApi.about(), []);
  const a = q.data;

  return (
    <>
      <PageHead eyebrow="About us" title="A family office sensibility, for every family" lead="Aureus Finserve is an AMFI-registered mutual fund distributor helping families invest with clarity, discipline and a long-term view." />

      {q.loading && !a ? (
        <section className="section">
          <div className="container">
            <SkeletonBlock rows={6} />
          </div>
        </section>
      ) : q.error && !a ? (
        <section className="section">
          <div className="container">
            <ErrorState error={q.error} onRetry={q.reload} />
          </div>
        </section>
      ) : (
        <>
          {a.story && (
            <section className="section" aria-labelledby="story-title">
              <div className="container pub-narrow">
                <SectionHeading eyebrow="Our story" title={<span id="story-title">Where we come from</span>} />
                <RichText body={a.story} headingLevel={3} className="pub-rich--lead" />
              </div>
            </section>
          )}
          {(a.mission || a.vision) && (
            <section className="section section--navy pub-mv" aria-label="Mission and vision">
              <div className="container grid grid-2">
                {a.mission && (
                  <div className="pub-mv__item">
                    <span className="eyebrow">Mission</span>
                    <p className="pub-mv__text">{a.mission}</p>
                  </div>
                )}
                {a.vision && (
                  <div className="pub-mv__item">
                    <span className="eyebrow">Vision</span>
                    <p className="pub-mv__text">{a.vision}</p>
                  </div>
                )}
              </div>
            </section>
          )}
          {a.values?.length > 0 && (
            <section className="section section--cream" aria-labelledby="values-title">
              <div className="container">
                <SectionHeading center eyebrow="What guides us" title={<span id="values-title">Our values</span>} />
                <ul className={`pub-why pub-why--center${a.values.length === 3 ? ' pub-why--3' : ''}`}>
                  {a.values.map((v, i) => (
                    <li key={v.title} className="pub-why__item">
                      <span className="pub-how__num" aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3>{v.title}</h3>
                      <p className="small muted">{v.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}

      <Team />
      {/* Hidden until the ARN and EUINs are received - uncomment to show "Registration and disclosures" again.
      <Credentials /> */}

      {/* Milestones hidden for now (the timeline still has placeholder years) - uncomment to show it again.
      {a?.milestones?.length > 0 && (
        <section className="section" aria-labelledby="ms-title">
          <div className="container pub-narrow">
            <SectionHeading eyebrow="Our journey" title={<span id="ms-title">Milestones</span>} />
            <ol className="pub-milestones">
              {a.milestones.map((m, i) => (
                <li key={`${m.year}-${i}`}>
                  <span className="pub-milestones__year">{m.year}</span>
                  <p>{m.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )} */}

      <div className="section--cream">
        <Office about={a} />
      </div>
    </>
  );
}
