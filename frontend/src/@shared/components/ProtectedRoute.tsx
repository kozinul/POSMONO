import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuth';

const CASHIER_ONLY_PATHS = ['/pos'];

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.roleName === 'Cashier' && !CASHIER_ONLY_PATHS.includes(location.pathname)) {
    return <Navigate to="/pos" replace />;
  }

  return <Outlet />;
}
