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
  { name: 'Categories', href: '/categories' },
  { name: 'Members', href: '/members' },
  { name: 'Promotions', href: '/promotions' },
  { name: 'Payment', href: '/payment-methods' },
  { name: 'Inventory', href: '/inventory' },
  { name: 'Templates', href: '/templates' },
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
        <Link to="/dashboard" className="text-xl font-semibold tracking-tight">
          POSMono
        </Link>
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

      <div className="flex flex-1 min-h-0 bg-gray-50">
        {!isPOSPage && (
          <aside className="w-60 shrink-0 border-r border-gray-200 bg-white shadow-sm overflow-y-auto">
            <nav className="p-4 space-y-1">
              {navigation.map((item) => {
                const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={clsx(
                      'flex items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        <main className={clsx('flex-1 min-w-0', isPOSPage ? 'flex overflow-hidden' : 'overflow-y-auto p-6')}>
          <div className={clsx(isPOSPage ? 'flex flex-1 min-h-0 w-full' : 'max-w-7xl mx-auto w-full')}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
