import { brand } from '../brand';
export function Skeleton({ width = '100%', height = 16, style, className = '' }) {
  return <div className={`skeleton ${className}`} style={{ width, height, ...style }} aria-hidden="true" />;
}

export function SkeletonBlock({ rows = 3, height = 18 }) {
  return (
    <div className="stack" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={height} width={i === rows - 1 ? '60%' : '100%'} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function SkeletonCards({ count = 4, height = 110 }) {
  return (
    <div className="grid grid-4" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} style={{ borderRadius: 8 }} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="page-loader" role="status">
      <img src={brand.markNavy} alt="" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
