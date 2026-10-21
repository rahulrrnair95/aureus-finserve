import Button from '../../components/Button';
import { PageHead } from '../../components/Misc';
import { Async, EmptyState } from '../../components/States';
import { SkeletonCards } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useTitle } from '../../utils/useTitle';
import { AmcTile } from './parts/Amc';

export default function AmcPartners() {
  useTitle('AMC partners');
  const q = useApi(() => publicApi.amcs(), []);
  return (
    <>
      <PageHead eyebrow="Fund houses" title="AMC partners" lead="We distribute Regular Plan schemes of these asset management companies under our ARN. Select a fund house to see its schemes with NAVs and returns from AMFI data; scheme documents are on each AMC's website." />
      <section className="section">
        <div className="container">
          <Async
            state={q}
            empty={(d) => !d.length}
            emptyView={<EmptyState title="No AMC partners listed yet" icon="briefcase" action={<Button variant="outline" to="/funds">Explore all funds</Button>} />}
            skeleton={<SkeletonCards count={8} height={130} />}
          >
            {(amcs) => (
              <ul className="pub-amc-grid">
                {amcs.map((a) => (
                  <li key={a.id} className="pub-amc-cell">
                    <AmcTile amc={a} showCount showName />
                    {a.website && (
                      <a className="pub-amc-site small" href={a.website} target="_blank" rel="noopener noreferrer">
                        {a.website.replace(/^https?:\/\/(www\.)?/, '')} ↗<span className="sr-only"> ({a.name} website, opens in new tab)</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Async>
          <p className="disclaimer-box small" style={{ marginTop: '2rem' }}>
            We are a distributor of these AMCs’ schemes; listing does not imply endorsement.
          </p>
        </div>
      </section>
    </>
  );
}
