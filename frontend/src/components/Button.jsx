import { Link } from 'react-router-dom';

/**
 * <Button variant="primary|gold|outline|outline-gold|ghost|danger|link" size="sm|md|lg" block loading to="/x" href="..">
 */
export default function Button({ variant = 'primary', size, block, loading, to, href, className = '', children, disabled, type = 'button', ...rest }) {
  const cls = ['btn', variant !== 'primary' && `btn--${variant}`, size && size !== 'md' && `btn--${size}`, block && 'btn--block', className].filter(Boolean).join(' ');
  const content = (
    <>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}
