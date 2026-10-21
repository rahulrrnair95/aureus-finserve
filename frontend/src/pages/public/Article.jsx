import { Link, useParams } from 'react-router-dom';
import { ExtLink, StandardDisclaimer } from '../../components/Misc';
import { ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import Button from '../../components/Button';
import { publicApi } from '../../api/endpoints';
import { useApi } from '../../api/useApi';
import { useTitle } from '../../utils/useTitle';
import { formatDate } from '../../utils/format';
import RichText from './parts/RichText';
import NotFoundBlock from './parts/NotFoundBlock';

/** YouTube watch / youtu.be / shorts / embed URL → embed URL; otherwise null. */
export function youtubeEmbed(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/);
        if (m) id = m[2];
      }
    }
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export default function Article() {
  const { slug } = useParams();
  const q = useApi(() => publicApi.article(slug), [slug]);
  const a = q.data;
  useTitle(a?.title || 'Article');

  if (q.error && (q.error.status === 404 || q.error.code === 'NOT_FOUND')) {
    return <NotFoundBlock title="Article not found" message="This article may have been moved or unpublished." backTo="/learn" backLabel="Knowledge centre" />;
  }

  const embed = a?.videoUrl ? youtubeEmbed(a.videoUrl) : null;

  return (
    <>
      <header className="page-head on-navy">
        <div className="container pub-narrow" style={{ marginLeft: 'auto' }}>
          <Link to="/learn" className="pub-back small">
            <span aria-hidden="true">←</span> Knowledge centre
          </Link>
          {a ? (
            <>
              {a.category && <span className="eyebrow" style={{ display: 'block', marginTop: '1rem' }}>{a.category}</span>}
              <h1>{a.title}</h1>
              <span className="gold-rule" aria-hidden="true" />
              <p className="small" style={{ margin: 0, color: 'var(--on-navy-muted)' }}>
                <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
                {a.readMinutes ? <> · {a.readMinutes} min read</> : null}
              </p>
            </>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              <SkeletonBlock rows={2} height={28} />
            </div>
          )}
        </div>
      </header>
      <section className="section">
        <div className="container pub-narrow">
          {q.error && !a ? (
            <ErrorState error={q.error} onRetry={q.reload} />
          ) : !a ? (
            <SkeletonBlock rows={10} />
          ) : (
            <article className="stack-lg">
              {a.summary && <p className="lead pub-article-lead">{a.summary}</p>}
              {a.videoUrl &&
                (embed ? (
                  <div className="pub-video">
                    <iframe src={embed} title={`Video: ${a.title}`} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
                  </div>
                ) : (
                  <p>
                    <ExtLink href={a.videoUrl} className="btn btn--outline">
                      Watch the video
                    </ExtLink>
                  </p>
                ))}
              <RichText body={a.body} />
              <hr className="pub-hr" />
              <StandardDisclaimer compact />
              <p className="tiny muted" style={{ margin: 0 }}>
                This article is for general information and education only. It is not investment, tax or legal advice.
              </p>
              <div className="row">
                <Button variant="outline" to="/learn">
                  More articles
                </Button>
                <Button to="/contact">Talk to us</Button>
              </div>
            </article>
          )}
        </div>
      </section>
    </>
  );
}
