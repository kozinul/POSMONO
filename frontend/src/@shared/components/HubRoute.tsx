import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuth';
import { useHubContext } from '../hooks/useHubMemberships';
import { Loading } from '../../core/platform/components/platformUi';

/**
 * The one place a blocked member learns *why* they cannot enter. Kept next to
 * the gate because the wording is the contract of `/hub-context/me`'s `blocked`
 * field — a message the user sees instead of a silent bounce to another
 * login form.
 */
const BLOCKED_MESSAGES: Record<string, (hubName: string | null) => string> = {
  membership_suspended: (hubName) =>
    `Keanggotaan Anda di hub ${hubName ?? 'ini'} ditangguhkan. Hubungi admin hub untuk mengaktifkan kembali.`,
  hub_suspended: (hubName) =>
    `Hub ${hubName ?? 'ini'} sedang ditangguhkan — akses anggota dinonaktifkan.`,
  hub_archived: (hubName) =>
    `Hub ${hubName ?? 'ini'} telah diarsipkan — akses anggota dinonaktifkan.`,
};

function HubAccessBlocked({ kind, hubName }: { kind: string; hubName: string | null }) {
  const message =
    BLOCKED_MESSAGES[kind]?.(hubName) ?? 'Anda tidak dapat mengakses hub ini. Hubungi pengelola.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center" role="alert">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Akses Hub Ditolak</h1>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <Link
          to="/hub/login"
          className="inline-block w-full py-2 px-4 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
        >
          Kembali ke Login
        </Link>
      </div>
    </div>
  );
}

/**
 * Hub V2 Fase 24 — gate for the hub console.
 *
 * A session alone is not enough: most accounts have no hub at all, and the
 * console would then be an empty shell. So this asks `/api/hub-context/me` —
 * the same endpoint the invite-acceptance page already uses — and sends anyone
 * without an active membership back to their own login.
 *
 * When the empty list has a *reason* (`blocked`: suspended membership,
 * suspended/archived hub), the user gets an explanation instead of the
 * redirect — being bounced to an unrelated login form with no words is what
 * used to make a status change look like a failed login.
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
    if (!error && data?.blocked) {
      return <HubAccessBlocked kind={data.blocked.kind} hubName={data.blocked.hubName} />;
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}
