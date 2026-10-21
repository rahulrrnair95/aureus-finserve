import Button from '../../../components/Button';

/** Friendly in-page "not found" panel used by detail pages. */
export default function NotFoundBlock({ title = 'We couldn’t find that page', message, backTo = '/', backLabel = 'Back to home' }) {
  return (
    <section className="section">
      <div className="container">
        <div className="pub-nf">
          <span className="pub-nf__code" aria-hidden="true">
            404
          </span>
          <h1 className="pub-nf__title">{title}</h1>
          <span className="gold-rule gold-rule--center gold-rule--dark" aria-hidden="true" />
          <p className="lead" style={{ margin: '0 auto 1.5rem' }}>
            {message || 'The link may be out of date, or the page may have moved.'}
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Button to={backTo}>{backLabel}</Button>
            <Button variant="outline" to="/contact">
              Contact us
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
