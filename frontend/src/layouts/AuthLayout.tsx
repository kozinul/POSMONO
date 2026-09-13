import { Outlet, useLocation } from 'react-router-dom';

export function AuthLayout() {
  const location = useLocation();
  const isTerminalLogin = location.pathname === '/terminal/login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            {isTerminalLogin ? 'POSMono · Terminal Center' : 'POSMono'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isTerminalLogin
              ? 'Platform Super Admin'
              : 'Business Operating System'}
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
