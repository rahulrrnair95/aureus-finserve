import { useState } from 'react';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useInvestor } from '../../layouts/InvestorLayout';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { Async, EmptyState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { formatDateTime } from '../../utils/format';
import { FilterChips, PageTitle } from './parts/common';

const TYPE = {
  ORDER: { icon: 'cart', label: 'Order' },
  SIP: { icon: 'repeat', label: 'SIP' },
  NAV: { icon: 'chart', label: 'NAV' },
  SECURITY: { icon: 'shield', label: 'Security' },
  GENERAL: { icon: 'info', label: 'General' },
};

export default function Notifications() {
  useTitle('Notifications');
  const toast = useToast();
  const { refreshUnread } = useInvestor();
  const q = useApi(() => investorApi.notifications(), []);
  const [busyId, setBusyId] = useState(null);
  const [allBusy, setAllBusy] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const unread = (q.data || []).filter((n) => !n.read).length;

  const markOne = async (n) => {
    setBusyId(n.id);
    try {
      await investorApi.readNotification(n.id);
      q.setData((l) => (l || []).map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      refreshUnread?.();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    setAllBusy(true);
    try {
      await investorApi.readAllNotifications();
      q.setData((l) => (l || []).map((x) => ({ ...x, read: true })));
      refreshUnread?.();
      toast.success('All notifications marked as read.');
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setAllBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Account" title="Notifications">
        <Button variant="outline" size="sm" onClick={markAll} loading={allBusy} disabled={!unread}>
          <Icon name="check" size={16} /> Mark all as read
        </Button>
      </PageTitle>
      <Async
        state={q}
        skeleton={<SkeletonBlock rows={6} height={28} />}
        empty={(d) => !d?.length}
        emptyView={
          <div className="card">
            <EmptyState title="You’re all caught up" icon="bell">
              Order updates, SIP reminders and security alerts will appear here.
            </EmptyState>
          </div>
        }
      >
        {(list) => {
          const shown = filter === 'UNREAD' ? list.filter((n) => !n.read) : list;
          return (
            <>
              <FilterChips
                label="Filter notifications"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'ALL', label: 'All', count: list.length },
                  { value: 'UNREAD', label: 'Unread', count: unread },
                ]}
              />
              {shown.length ? (
                <ul className="inv-notes">
                  {shown.map((n) => {
                    const t = TYPE[n.type] || TYPE.GENERAL;
                    return (
                      <li key={n.id} className={`inv-note ${n.read ? '' : 'inv-note--unread'} inv-note--${String(n.type || 'GENERAL').toLowerCase()}`}>
                        <span className="inv-note__icon" aria-hidden="true">
                          <Icon name={t.icon} size={20} />
                        </span>
                        <div className="inv-note__body">
                          <div className="inv-note__top">
                            <h2 className="inv-note__title">
                              {!n.read && <span className="sr-only">Unread: </span>}
                              {n.title}
                            </h2>
                            <span className="tiny muted">
                              {t.label} · <time dateTime={n.createdAt}>{formatDateTime(n.createdAt)}</time>
                            </span>
                          </div>
                          <p className="small" style={{ margin: '0.25rem 0 0' }}>
                            {n.message}
                          </p>
                        </div>
                        {!n.read && (
                          <Button variant="link" size="sm" onClick={() => markOne(n)} loading={busyId === n.id} aria-label={`Mark “${n.title}” as read`}>
                            Mark as read
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="card">
                  <EmptyState title="No unread notifications" icon="check" />
                </div>
              )}
            </>
          );
        }}
      </Async>
    </div>
  );
}
