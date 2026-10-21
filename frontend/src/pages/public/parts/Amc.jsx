import { Link } from 'react-router-dom';
import { initials } from './content';

export const amcFundsUrl = (name) => `/funds?amc=${encodeURIComponent(name)}`;

/** Logo tile, or a styled text tile when logoUrl is null. */
export function AmcTile({ amc, tabIndex, showCount = false, showName = false }) {
  return (
    <Link to={amcFundsUrl(amc.name)} className="pub-amc" tabIndex={tabIndex} aria-label={`${amc.name}${showCount && amc.schemeCount != null ? `, ${amc.schemeCount} schemes` : ''} — view funds`}>
      {amc.logoUrl ? (
        <>
          <img src={amc.logoUrl} alt="" className="pub-amc__logo" loading="lazy" />
          {showName && <span className="pub-amc__caption">{amc.name}</span>}
        </>
      ) : (
        <span className="pub-amc__text" aria-hidden="true">
          <span className="pub-amc__mono">{initials(amc.name)}</span>
          <span className="pub-amc__name">{amc.name}</span>
        </span>
      )}
      {showCount && amc.schemeCount != null && (
        <span className="pub-amc__count" aria-hidden="true">
          {amc.schemeCount} {amc.schemeCount === 1 ? 'scheme' : 'schemes'}
        </span>
      )}
    </Link>
  );
}

/** Auto-scrolling strip: pauses on hover / focus-within; static wrapping row under reduced motion. */
export function AmcStrip({ amcs }) {
  return (
    <div className="pub-marquee">
      <div className="pub-marquee__track">
        <ul className="pub-marquee__list" aria-label="AMC partners">
          {amcs.map((a) => (
            <li key={a.id}>
              <AmcTile amc={a} />
            </li>
          ))}
        </ul>
        <ul className="pub-marquee__list pub-marquee__dup" aria-hidden="true">
          {amcs.map((a) => (
            <li key={`d-${a.id}`}>
              <AmcTile amc={a} tabIndex={-1} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
