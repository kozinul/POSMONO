import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../@shared/hooks/useAuth';
import { ErrorBoundary } from '../@shared/components/ErrorBoundary';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'POS', href: '/pos' },
  { name: 'Orders', href: '/orders' },
  { name: 'Products', href: '/products' },
  { name: 'Families', href: '/families' },
  { name: 'Menu Types', href: '/menu-types' },
  { name: 'Members', href: '/members' },
  { name: 'Promotions', href: '/promotions' },
  { name: 'Payment', href: '/payment-methods' },
  { name: 'Inventory', href: '/inventory' },
  { name: 'Reports', href: '/reports' },
  { name: 'Shifts', href: '/shifts' },
  { name: 'Settings', href: '/settings' },
];

export function DashboardLayout() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const isPOSPage = location.pathname === '/pos';

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="blue-primary text-white h-16 flex items-center justify-between px-6 shrink-0 shadow-md z-10">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="text-xl font-semibold tracking-tight">
            POSMono
          </Link>
          {!isPOSPage && (
            <nav className="flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    location.pathname.startsWith(item.href)
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/10',
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-white/80">{user.displayName}</span>
          )}
          <button
            onClick={logout}
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className={clsx('flex-1 flex', isPOSPage ? 'overflow-hidden' : 'overflow-y-auto max-w-7xl mx-auto p-6 w-full')}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
