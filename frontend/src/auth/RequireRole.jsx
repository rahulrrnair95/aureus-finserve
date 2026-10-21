import { Navigate, useLocation } from 'react-router-dom';
import { homeForRole, useAuth } from './AuthContext';
import { PageLoader } from '../components/Skeleton';

/** Route guard: renders children only for logged-in users with one of `roles`. */
export default function RequireRole({ roles, children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return children;
}
