import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuth';

export function PlatformRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/terminal/login" replace state={{ from: location.pathname }} />;
  }

  if (user?.tenantId !== 'platform') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}