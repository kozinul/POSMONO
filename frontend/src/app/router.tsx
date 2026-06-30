import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import NotFoundPage from '../@shared/pages/NotFoundPage';

const LoginPage = lazy(() => import('../core/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('../core/dashboard/pages/DashboardPage'));
const PosPage = lazy(() => import('../core/pos/pages/PosPage'));
const OrderListPage = lazy(() => import('../core/orders/pages/OrderListPage'));
const ProductListPage = lazy(() => import('../core/products/pages/ProductListPage'));
const StockListPage = lazy(() => import('../core/inventory/pages/StockListPage'));
const SettingsPage = lazy(() => import('../core/settings/pages/GeneralSettingsPage'));
const ReportPage = lazy(() => import('../core/reports/pages/ReportPage'));
const ShiftPage = lazy(() => import('../core/shifts/pages/ShiftPage'));

const Loading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
  </div>
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/pos" element={<PosPage />} />
            <Route path="/orders" element={<OrderListPage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/inventory" element={<StockListPage />} />
            <Route path="/reports" element={<ReportPage />} />
            <Route path="/shifts" element={<ShiftPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
