import Button from './Button';
import Icon from './Icon';
import { friendlyError } from '../api/client';
import { SkeletonBlock } from './Skeleton';

export function Alert({ type = 'info', title, children, action }) {
  const role = type === 'error' ? 'alert' : 'status';
  const icon = type === 'error' ? 'alert' : type === 'success' ? 'check' : type === 'warning' ? 'alert' : 'info';
  return (
    <div className={`alert alert--${type}`} role={role}>
      <Icon name={icon} size={20} />
      <div className="alert__body">
        {title && <div className="alert__title">{title}</div>}
        {children}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', children, icon = 'inbox', action }) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon name={icon} size={48} strokeWidth={1.2} />
      </div>
      <div className="empty__title">{title}</div>
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'We couldn’t load this' }) {
  return (
    <div className="empty" role="alert">
      <div className="empty__icon" style={{ color: 'var(--danger)' }}>
        <Icon name="alert" size={48} strokeWidth={1.2} />
      </div>
      <div className="empty__title">{title}</div>
      <p className="small">{friendlyError(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Renders loading / error / empty / content for a useApi result.
 * <Async state={q} empty={(d)=>!d.length} emptyView={<EmptyState/>} skeleton={<SkeletonBlock rows={4}/>}>{(data)=>...}</Async>
 */
export function Async({ state, children, empty, emptyView, skeleton }) {
  const { data, error, loading, reload } = state;
  if (loading && data === undefined) return skeleton || <SkeletonBlock rows={4} />;
  if (error && data === undefined) return <ErrorState error={error} onRetry={reload} />;
  if (data === undefined || data === null) return skeleton || <SkeletonBlock rows={4} />;
  if (empty && empty(data)) return emptyView || <EmptyState />;
  return children(data);
}

export function DevOtp({ code }) {
  if (!code) return null;
  return (
    <p>
      <span className="dev-otp">Dev OTP: {code}</span>
    </p>
  );
}
