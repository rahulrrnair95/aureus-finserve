import { Link, useParams } from 'react-router-dom';
import { PageHead } from '../../components/Misc';
import { EmptyState, ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useTitle } from '../../utils/useTitle';
import { formatDate } from '../../utils/format';
import RichText from './parts/RichText';
import NotFoundBlock from './parts/NotFoundBlock';

const LEGAL = {
  disclaimer: 'Disclaimer',
  privacy: 'Privacy policy',
  terms: 'Terms of use',
  commission: 'Commission disclosure',
};

export default function LegalPage() {
  const { key } = useParams();
  const known = Object.prototype.hasOwnProperty.call(LEGAL, key);
  const q = useApi(() => publicApi.page(key), [key], { enabled: known });
  const p = q.data;
  useTitle(p?.title || LEGAL[key] || 'Page not found');

  if (!known || (q.error && (q.error.status === 404 || q.error.code === 'NOT_FOUND'))) {
    return <NotFoundBlock title="Page not found" message="We couldn’t find that legal page. You can find all our disclosures in the footer." />;
  }

  return (
    <>
      <PageHead eyebrow="Legal and disclosures" title={p?.title || LEGAL[key]} lead={p?.updatedAt ? `Last updated ${formatDate(p.updatedAt)}` : undefined} />
      <section className="section">
        <div className="container pub-legal">
          <nav aria-label="Legal pages" className="pub-legal__nav">
            <ul>
              {Object.entries(LEGAL).map(([k, label]) => (
                <li key={k}>
                  <Link to={`/legal/${k}`} aria-current={k === key ? 'page' : undefined}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            {q.loading && !p ? (
              <SkeletonBlock rows={10} />
            ) : q.error && !p ? (
              <ErrorState error={q.error} onRetry={q.reload} />
            ) : p?.body ? (
              <>
                <RichText body={p.body} />
                {p.updatedAt && (
                  <p className="tiny muted" style={{ marginTop: '2rem' }}>
                    Last updated: <time dateTime={p.updatedAt}>{formatDate(p.updatedAt)}</time>
                  </p>
                )}
              </>
            ) : (
              <EmptyState title="This page is being updated" icon="file" />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
