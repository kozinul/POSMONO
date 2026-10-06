import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuth';
import { useHubContext } from '../hooks/useHubMemberships';
import { Loading } from '../../core/platform/components/platformUi';

/**
 * Hub V2 Fase 24 — gate for the hub console.
 *
 * A session alone is not enough: most accounts have no hub at all, and the
 * console would then be an empty shell. So this asks `/api/hub-context/me` —
 * the same endpoint the invite-acceptance page already uses — and sends anyone
 * without an active membership back to their own login.
 *
 * It reads the membership per request rather than the JWT for the same reason the
 * backend does: `hub.*` permissions are absent from tokens, and a hub that has
 * been suspended must stop being usable immediately, not at the next refresh.
 *
 * Mounted **outside** `ProtectedRoute` on purpose. `ProtectedRoute` bounces a
 * `Cashier` to `/pos`, and a cashier is a perfectly legitimate hub `viewer` —
 * routing them away would make the invitation they were just sent unclaimable.
 */
export function HubRoute({ children }: { children?: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  const { data, isLoading, error } = useHubContext();

  if (!isAuthenticated) {
    return <Navigate to="/hub/login" replace state={{ from: location.pathname }} />;
  }

  if (isLoading) {
    return <Loading label="Memeriksa keanggotaan hub..." />;
  }

  // A failed check is treated as "not a member" rather than as a crash: the
  // member-facing endpoint answers 401/403 for accounts without a hub.
  const hubs = error ? [] : (data?.hubs ?? []);
  if (hubs.length === 0) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}
