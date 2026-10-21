import { Link } from 'react-router-dom';
import { useTitle } from '../../utils/useTitle';
import { brand } from '../../brand';

export default function NotFound() {
  useTitle('Page not found');
  return (
    <section className="pub-404 on-navy" aria-labelledby="nf-title">
      <div className="container center">
        <img src={brand.markGold} alt="" width="130" height="105" className="pub-404__mark" />
        <span className="eyebrow">Error 404</span>
        <h1 id="nf-title">This page has moved on</h1>
        <span className="gold-rule gold-rule--center" aria-hidden="true" />
        <p className="lead" style={{ margin: '0 auto 2rem' }}>
          The page you are looking for doesn’t exist or may have been moved. These links may help.
        </p>
        <nav aria-label="Helpful links">
          <ul className="pub-404__links">
            <li>
              <Link to="/" className="btn btn--gold">
                Home
              </Link>
            </li>
            <li>
              <Link to="/funds" className="btn btn--outline-gold">
                Explore funds
              </Link>
            </li>
            <li>
              <Link to="/contact" className="btn btn--outline-gold">
                Contact us
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </section>
  );
}
