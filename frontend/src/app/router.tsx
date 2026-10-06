import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { TerminalLayout } from '../layouts/TerminalLayout';
import { HubLayout } from '../layouts/HubLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from '../@shared/components/ProtectedRoute';
import { PlatformRoute } from '../@shared/components/PlatformRoute';
import { HubRoute } from '../@shared/components/HubRoute';
import NotFoundPage from '../@shared/pages/NotFoundPage';

// Lazy-loaded pages
const LoginPage = lazy(() => import('../core/auth/pages/LoginPage'));
const TerminalLoginPage = lazy(() => import('../core/platform/pages/TerminalLoginPage'));
// Hub V2 Fase 24 — the hub console's own entrance, for hub members rather than
// platform operators or tenant staff.
const HubLoginPage = lazy(() => import('../core/hub/pages/HubLoginPage'));
const HubCenterPage = lazy(() => import('../core/hub/pages/HubCenterPage'));
const DashboardPage = lazy(() => import('../core/dashboard/pages/DashboardPage'));
const PosPage = lazy(() => import('../core/pos/pages/PosPage'));
const OrderListPage = lazy(() => import('../core/orders/pages/OrderListPage'));
const ProductListPage = lazy(() => import('../core/products/pages/ProductListPage'));
const FamilyListPage = lazy(() => import('../core/families/pages/FamilyListPage'));
const CategoryListPage = lazy(() => import('../core/categories/pages/CategoryListPage'));
const StockListPage = lazy(() => import('../core/inventory/pages/StockListPage'));
const WarehouseListPage = lazy(() => import('../core/inventory/pages/WarehouseListPage'));
const OutletListPage = lazy(() => import('../core/outlets/pages/OutletListPage'));
const SettingsPage = lazy(() => import('../core/settings/pages/GeneralSettingsPage'));
const PrinterSettingsPage = lazy(() => import('../core/printing/pages/PrinterSettingsPage'));
const ReportPage = lazy(() => import('../core/reports/pages/ReportPage'));
const ShiftPage = lazy(() => import('../core/shifts/pages/ShiftPage'));
const MemberListPage = lazy(() => import('../core/members/pages/MemberListPage'));
const PromotionListPage = lazy(() => import('../core/promotions/pages/PromotionListPage'));
const PaymentMethodListPage = lazy(() => import('../core/payment-methods/pages/PaymentMethodListPage'));
const UserListPage = lazy(() => import('../core/users/pages/UserListPage'));
const TemplateListPage = lazy(() => import('../core/templates/pages/TemplateListPage'));
const DesignerPage = lazy(() => import('../core/templates/pages/DesignerPage'));
const DatabasePage = lazy(() => import('../core/database/pages/DatabasePage'));
const RefundPage = lazy(() => import('../core/refunds/pages/RefundPage'));
const ModifierListPage = lazy(() => import('../core/modifiers/pages/ModifierListPage'));
const TerminalCenterPage = lazy(() => import('../core/platform/pages/TerminalCenterPage'));
// Hub V2 Fase 20 — an ordinary tenant user redeeming an invitation. Inside
// ProtectedRoute (the server checks the signed-in address) but outside
// DashboardLayout: a brand-new hub member has no menu entries worth showing.
const HubInvitationPage = lazy(() => import('../core/hub/pages/HubInvitationPage'));
const TenantDetailPage = lazy(() => import('../core/platform/pages/TenantDetailPage'));

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
            <Route path="/terminal/login" element={<TerminalLoginPage />} />
            <Route path="/hub/login" element={<HubLoginPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/orders" element={<OrderListPage />} />
              <Route path="/refunds" element={<RefundPage />} />
              <Route path="/products" element={<ProductListPage />} />
              <Route path="/families" element={<FamilyListPage />} />
              <Route path="/categories" element={<CategoryListPage />} />
              <Route path="/modifiers" element={<ModifierListPage />} />
              <Route path="/inventory" element={<StockListPage />} />
              <Route path="/inventory/warehouses" element={<WarehouseListPage />} />
              <Route path="/outlets" element={<OutletListPage />} />
              <Route path="/reports" element={<ReportPage />} />
              <Route path="/reports/sales-per-product" element={<Navigate to="/reports" replace />} />
              <Route path="/shifts" element={<ShiftPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/printers" element={<PrinterSettingsPage />} />
              <Route path="/members" element={<MemberListPage />} />
              <Route path="/promotions" element={<PromotionListPage />} />
              <Route path="/payment-methods" element={<PaymentMethodListPage />} />
              <Route path="/users" element={<UserListPage />} />
              <Route path="/templates" element={<TemplateListPage />} />
              <Route path="/templates/:id/designer" element={<DesignerPage />} />
              <Route path="/database" element={<DatabasePage />} />
            </Route>
            {/* Hub V2 Fase 20 — guarded like any tenant page, but without the
                dashboard chrome: see the lazy import above. */}
            <Route path="/hub-invitations/:token" element={<HubInvitationPage />} />
          </Route>
          <Route element={<PlatformRoute />}>
            <Route element={<TerminalLayout />}>
              <Route path="/terminal-center" element={<TerminalCenterPage />} />
              <Route path="/terminal-center/tenants/:tenantId" element={<TenantDetailPage />} />
            </Route>
          </Route>
          {/* Hub V2 Fase 24 — a member of any hub role, including `viewer` and
              cashier, so this must sit outside ProtectedRoute (which bounces
              Cashier to /pos) and outside DashboardLayout (tenant chrome). */}
          <Route element={<HubRoute />}>
            <Route element={<HubLayout />}>
              <Route path="/hub" element={<HubCenterPage />} />
            </Route>
          </Route>
          <Route path="/terminal" element={<Navigate to="/terminal-center" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
