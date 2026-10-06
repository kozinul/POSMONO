import { Link, Outlet } from 'react-router-dom';
import { useAuthStore } from '../@shared/hooks/useAuth';
import { ErrorBoundary } from '../@shared/components/ErrorBoundary';

/**
 * Hub V2 Fase 24 — chrome for the hub console.
 *
 * A sibling of `TerminalLayout`, not a page inside `DashboardLayout`: the POS
 * shell carries tenant navigation, an outlet switcher and a cashier shortcut that
 * mean nothing here, and a hub member may well have no tenant position at all.
 */
export function HubLayout() {
  const { user, logout } = useAuthStore();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="blue-primary text-white h-16 flex items-center justify-between px-6 shrink-0 shadow-md z-10">
        <Link to="/hub" className="text-xl font-semibold tracking-tight">
          POSMono &middot; Hub Center
        </Link>
        <div className="flex items-center gap-4">
          {user && <span className="text-sm text-white/80">{user.displayName}</span>}
          <button
            onClick={logout}
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 bg-gray-50 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto w-full">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
