import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import { ExtLink, PageHead, SectionHeading } from '../../components/Misc';
import { EmptyState, ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useSite } from '../../auth/SiteContext';
import { useTitle } from '../../utils/useTitle';
import RichText from './parts/RichText';

const COLUMNS = [
  { key: 'level', header: 'Level', render: (r) => <strong>Level {r.level}</strong>, primary: true },
  { key: 'name', header: 'Name', render: (r) => r.name || '—' },
  { key: 'designation', header: 'Designation', render: (r) => r.designation || '—' },
  { key: 'phone', header: 'Phone', render: (r) => (r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : '—') },
  { key: 'email', header: 'Email', render: (r) => (r.email ? <a href={`mailto:${r.email}`} className="pub-break">{r.email}</a> : '—') },
  { key: 'responseDays', header: 'Response within', render: (r) => (r.responseDays != null ? `${r.responseDays} days` : '—') },
];

export default function Grievance() {
  useTitle('Grievance redressal');
  const { site, loaded } = useSite();
  const page = useApi(() => publicApi.page('grievance'), []);
  const esc = [...(site.escalation || [])].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const nodal = site.nodalOfficer;

  return (
    <>
      <PageHead eyebrow="Investor care" title="Grievance redressal" lead="We aim to resolve every concern promptly and fairly. Every complaint is acknowledged and resolved within 21 days." />

      <section className="section">
        <div className="container stack-lg">
          <SectionHeading eyebrow="Escalation matrix" title="How to raise a concern" lead="Start with Level 1. If you are not satisfied with the response within the stated time, escalate to the next level." />
          {!loaded ? (
            <SkeletonBlock rows={4} height={28} />
          ) : esc.length ? (
            <DataTable columns={COLUMNS} rows={esc} rowKey="level" caption="Grievance escalation matrix" />
          ) : (
            <EmptyState title="Escalation details are being updated" icon="users">
              Please write to us at the email address below in the meantime.
            </EmptyState>
          )}

          <div className="grid grid-2">
            <div className="card card--navy pub-nodal">
              <span className="eyebrow">Nodal officer</span>
              {nodal?.name ? (
                <>
                  <h3 className="card__title">{nodal.name}</h3>
                  <ul className="pub-contact-list">
                    {nodal.phone && (
                      <li>
                        Phone: <a href={`tel:${nodal.phone}`}>{nodal.phone}</a>
                      </li>
                    )}
                    {nodal.email && (
                      <li>
                        Email: <a href={`mailto:${nodal.email}`}>{nodal.email}</a>
                      </li>
                    )}
                  </ul>
                </>
              ) : (
                <p>Nodal officer details will be published here.</p>
              )}
            </div>
            <div className="card card--accent">
              <h3 className="card__title">Our commitment</h3>
              <p className="small">
                Complaints are acknowledged promptly and resolved within <strong>21 days</strong> of receipt. Please include your name, PAN (last four characters
                are enough), folio number and a short description so we can help faster.
              </p>
              <Button variant="outline" to="/contact">
                Contact us
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--cream" aria-labelledby="ext-title">
        <div className="container">
          <SectionHeading eyebrow="If you are still not satisfied" title={<span id="ext-title">Regulatory escalation</span>} />
          <div className="grid grid-2">
            <div className="card">
              <h3 className="card__title">SEBI SCORES</h3>
              <p className="small">
                SCORES is SEBI’s online complaints redress system. You can lodge a complaint there if your grievance is not resolved by us, and track its status
                online.
              </p>
              <ExtLink href={site.scoresUrl || 'https://scores.sebi.gov.in/'} className="btn btn--outline">
                Visit SEBI SCORES
              </ExtLink>
            </div>
            <div className="card">
              <h3 className="card__title">SMART ODR</h3>
              <p className="small">
                The Securities Market Approach for Resolution Through Online Dispute Resolution (SMART ODR) portal offers conciliation and arbitration for
                disputes not resolved through SCORES or directly with us.
              </p>
              <ExtLink href={site.odrUrl || 'https://smartodr.in/'} className="btn btn--outline">
                Visit SMART ODR
              </ExtLink>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-label="Grievance redressal policy">
        <div className="container">
          {page.loading && !page.data ? (
            <SkeletonBlock rows={6} />
          ) : page.error && !page.data ? (
            page.error.status === 404 ? null : <ErrorState error={page.error} onRetry={page.reload} />
          ) : page.data?.body ? (
            <>
              <h2>{page.data.title || 'Grievance redressal policy'}</h2>
              <span className="gold-rule gold-rule--dark" aria-hidden="true" />
              <RichText body={page.data.body} headingLevel={3} />
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}
