import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, hasPermission } from '../@shared/hooks/useAuth';
import { useAccessibleTenants } from '../@shared/hooks/useHubMemberships';
import { useOutlets } from '../@shared/hooks/useOutlets';
import { useRealtimeSync } from '../@shared/hooks/useRealtimeSync';
import { ErrorBoundary } from '../@shared/components/ErrorBoundary';
import clsx from 'clsx';

interface NavItem {
  name: string;
  href: string;
  permission?: string;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'POS', href: '/pos' },
  { name: 'Orders', href: '/orders' },
  { name: 'Refunds', href: '/refunds' },
  { name: 'Products', href: '/products' },
  { name: 'Families', href: '/families' },
  { name: 'Categories', href: '/categories' },
  { name: 'Modifiers', href: '/modifiers', permission: 'products:write' },
  { name: 'Members', href: '/members' },
  { name: 'Promotions', href: '/promotions' },
  { name: 'Payment', href: '/payment-methods' },
  { name: 'Inventory', href: '/inventory' },
  { name: 'Gudang', href: '/inventory/warehouses' },
  { name: 'Outlet', href: '/outlets', permission: 'outlet:manage' },
  { name: 'Templates', href: '/templates' },
  { name: 'Reports', href: '/reports' },
  { name: 'Shifts', href: '/shifts' },
  { name: 'Users', href: '/users' },
  { name: 'Settings', href: '/settings' },
  { name: 'Printer', href: '/settings/printers' },
  { name: 'Database', href: '/database' },
];

const OUTLET_SCOPE_KEYS: ReadonlyArray<readonly string[]> = [
  ['inventory'],
  ['products'],
  ['orders'],
  ['shifts'],
  ['daily-report'],
  ['sales-report'],
  ['best-sellers'],
];

export function DashboardLayout() {
  const location = useLocation();
  const { user, logout, activeOutletId, setActiveOutletId, switchTenant } = useAuthStore();
  const isPOSPage = location.pathname === '/pos';

  // Redirect platform super admin to Terminal Center
  if (user?.tenantId === 'platform') {
    return <Navigate to="/terminal-center" replace />;
  }

  useRealtimeSync();

  const queryClient = useQueryClient();
  const { data: outlets = [] } = useOutlets();
  const { data: accessibleTenants = [] } = useAccessibleTenants();

  const currentTenantId = user?.tenantId ?? '';
  const currentTenantName = accessibleTenants.find((t) => t.tenantId === currentTenantId)?.tenantName ?? null;
  const showTenantSwitcher = accessibleTenants.length > 0 && currentTenantId !== 'platform';

  const visibleNavigation = navigation.filter(
    (item) =>
      (user?.roleName === 'Cashier' ? item.href === '/pos' : !item.permission || hasPermission(user, item.permission)),
  );

  const availableOutlets =
    !!user && user.outletIds && user.outletIds.length > 0
      ? outlets.filter((o) => user.outletIds!.includes(o.id))
      : outlets;
  const showOutletSwitcher = availableOutlets.length > 1;
  const currentOutletName = availableOutlets.find((o) => o.id === activeOutletId)?.name ?? null;

  const handleOutletChange = (outletId: string) => {
    setActiveOutletId(outletId || null);
    for (const key of OUTLET_SCOPE_KEYS) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const handleTenantSwitch = async (tenantId: string) => {
    if (tenantId === currentTenantId) return;
    const ok = await switchTenant(tenantId);
    if (ok) {
      queryClient.clear();
    } else {
      alert('Gagal beralih tenant');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="blue-primary text-white h-16 flex items-center justify-between px-6 shrink-0 shadow-md z-10">
        <Link to="/dashboard" className="text-xl font-semibold tracking-tight">
          POSMono
        </Link>
        <div className="flex items-center gap-4">
          {showTenantSwitcher && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Tenant:</span>
              <select
                aria-label="Ganti Tenant"
                value={currentTenantId}
                onChange={(e) => handleTenantSwitch(e.target.value)}
                className="text-sm bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                {accessibleTenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId} className="text-gray-900">
                    {t.tenantName} · {t.hubName}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!showTenantSwitcher && currentTenantName && (
            <span className="text-sm text-white/70 hidden sm:inline">{currentTenantName}</span>
          )}
          {showOutletSwitcher && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Outlet:</span>
              <select
                aria-label="Pilih Outlet"
                value={activeOutletId ?? ''}
                onChange={(e) => handleOutletChange(e.target.value)}
                className="text-sm bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                {availableOutlets.map((o) => (
                  <option key={o.id} value={o.id} className="text-gray-900">
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {currentOutletName && !showOutletSwitcher && (
            <span className="text-sm text-white/70 hidden sm:inline">{currentOutletName}</span>
          )}
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
              {visibleNavigation.map((item) => {
                const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                const classes = clsx(
                  'flex items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                );
                return item.href === '/pos' ? (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classes}
                  >
                    {item.name}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={classes}
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
