import { Outlet, useLocation } from 'react-router-dom';

const CONSOLE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/terminal/login': { title: 'POSMono · Terminal Center', subtitle: 'Platform Super Admin' },
  '/hub/login': { title: 'POSMono · Hub Center', subtitle: 'Anggota hub' },
};

export function AuthLayout() {
  const location = useLocation();
  // Each console brings its own title; the default is the tenant POS login.
  const title = CONSOLE_TITLES[location.pathname];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            {title ? title.title : 'POSMono'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {title ? title.subtitle : 'Business Operating System'}
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
