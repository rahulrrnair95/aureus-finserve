import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import CartBuilder from '../../components/order/CartBuilder';
import { Alert, ErrorState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { PageTitle } from './parts/common';

const TYPES = ['LUMPSUM', 'SIP', 'REDEEM', 'SWITCH', 'STP', 'SWP'];

export default function Transact() {
  useTitle('Invest & transact');
  const { user } = useAuth();
  const [params] = useSearchParams();
  const holdings = useApi(() => investorApi.holdings(), []);

  const scheme = params.get('scheme');
  const type = (params.get('type') || '').toUpperCase();
  const folio = params.get('folio');
  const preselect = useMemo(() => {
    const p = {};
    if (scheme) p.schemeId = Number.isNaN(Number(scheme)) ? scheme : Number(scheme);
    if (TYPES.includes(type)) p.type = type;
    if (folio) p.folioId = Number.isNaN(Number(folio)) ? folio : Number(folio);
    return Object.keys(p).length ? p : undefined;
  }, [scheme, type, folio]);

  let body;
  if (!user?.investorId) {
    body = <Alert type="error">We could not identify your investor account. Please log in again or contact your relationship manager.</Alert>;
  } else if (holdings.loading && holdings.data === undefined) {
    body = <SkeletonBlock rows={8} height={22} />;
  } else if (holdings.error && holdings.data === undefined) {
    body = <ErrorState error={holdings.error} onRetry={holdings.reload} title="We couldn’t load your folios" />;
  } else {
    body = (
      <CartBuilder
        key={params.toString()}
        mode="investor"
        investorId={user.investorId}
        holdings={holdings.data || []}
        preselect={preselect}
        onSubmit={(cart) => investorApi.placeOrders(cart)}
      />
    );
  }

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Transact" title="Invest & transact" />
      <p className="lead" style={{ marginTop: '-0.75rem' }}>
        Buy, start a SIP, redeem, switch or set up STP / SWP in your own folios. Orders are placed on the exchange through Aureus Finserve as your distributor.
      </p>
      {body}
    </div>
  );
}
