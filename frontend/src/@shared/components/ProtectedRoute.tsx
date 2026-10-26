import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuth';

const CASHIER_ONLY_PATHS = ['/pos'];
const KDS_ONLY_PATHS = ['/kds'];

/**
 * Hub V2 Fase 20 — a hub invitation is redeemed by whoever the platform admin
 * invited, whatever their role in their home tenant. A cashier of one tenant is
 * a perfectly valid `viewer` in a hub, so bouncing them to /pos here would make
 * their invitation unredeemable.
 */
const CASHIER_ALLOWED_PREFIXES = ['/hub-invitations'];

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isInvitationPath = CASHIER_ALLOWED_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );

  // A station display role must never land on the dashboard or POS, even when
  // it follows a stale link. It only reads the KDS board.
  if (user?.roleName === 'KDS' && !KDS_ONLY_PATHS.includes(location.pathname)) {
    return <Navigate to="/kds" replace />;
  }

  if (
    user?.roleName === 'Cashier' &&
    !CASHIER_ONLY_PATHS.includes(location.pathname) &&
    !isInvitationPath
  ) {
    return <Navigate to="/pos" replace />;
  }

  return <Outlet />;
}
