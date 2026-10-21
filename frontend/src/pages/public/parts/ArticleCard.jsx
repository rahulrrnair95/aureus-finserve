import { Link } from 'react-router-dom';
import { formatDate } from '../../../utils/format';

export default function ArticleCard({ a, headingLevel = 3 }) {
  const H = `h${headingLevel}`;
  return (
    <article className="pub-article-card">
      <div className="row tiny">
        {a.category && <span className="chip chip--gold">{a.category}</span>}
        {a.videoUrl && <span className="chip chip--navy">Video</span>}
      </div>
      <H className="pub-article-card__title">
        <Link to={`/learn/articles/${encodeURIComponent(a.slug)}`}>{a.title}</Link>
      </H>
      {a.summary && <p className="small muted">{a.summary}</p>}
      <p className="tiny muted pub-article-card__meta">
        <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
        {a.readMinutes ? <> · {a.readMinutes} min read</> : null}
      </p>
    </article>
  );
}
