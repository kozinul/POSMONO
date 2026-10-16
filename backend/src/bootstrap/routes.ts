import { Express, RequestHandler } from 'express';
import mongoose from 'mongoose';
import type { DIContainer } from './container';
import { createResolveOutlet } from '../@shared/interfaces/middleware/resolveOutlet';
import { createAuthRateLimiter } from '../@shared/interfaces/middleware/rateLimit';
import { createTenantStatusGate } from '../core/tenant/interfaces/http/middleware/tenantTransactionGate';
import { createAuthRoutes } from '../core/identity/interfaces/http/routes/auth.routes';
import { createTenantRoutes } from '../core/tenant/interfaces/http/routes/tenant.routes';
import { createProductRoutes } from '../core/catalog/interfaces/http/routes/product.routes';
import { createCategoryRoutes } from '../core/catalog/interfaces/http/routes/category.routes';
import { createFamilyRoutes } from '../core/catalog/interfaces/http/routes/family.routes';
import { createModifierRoutes } from '../core/catalog/interfaces/http/routes/modifier.routes';
import { createInventoryRoutes } from '../core/inventory/interfaces/http/routes/inventory.routes';
import { createWarehouseRoutes } from '../core/inventory/interfaces/http/routes/warehouse.routes';
import { createRoleRoutes } from '../core/identity/interfaces/http/routes/role.routes';
import { createUserRoutes } from '../core/identity/interfaces/http/routes/user.routes';
import { createPermissionRoutes } from '../core/identity/interfaces/http/routes/permission.routes';
import { createOrderRoutes } from '../core/ordering/interfaces/http/routes/order.routes';
import { createShiftRoutes } from '../core/pos/interfaces/http/routes/shift.routes';
import { createPaymentRoutes } from '../core/payment/interfaces/http/routes/payment.routes';
import { createReportRoutes } from '../core/reporting/interfaces/http/routes/report.routes';
import { createTaxRoutes } from '../core/tax/api/tax.routes';
import { createPricingProfileRoutes } from '../core/pricing/api/pricingProfile.routes';
import { createDiscountRouter } from '../core/discount/api/discount.routes';
import { createCustomerRoutes } from '../core/customer/interfaces/http/routes/customer.routes';
import { createSettingRoutes } from '../core/settings/interfaces/http/routes/setting.routes';
import { createUploadRoutes } from '../core/upload/interfaces/http/routes/upload.routes';
import { createPromotionRoutes } from '../core/promotion/interfaces/http/routes/promotion.routes';
import { createPaymentMethodRoutes } from '../core/payment/interfaces/http/routes/paymentMethod.routes';
import { createMenuTypeRoutes } from '../core/catalog/interfaces/http/routes/menuType.routes';
import { createPricingRouter } from '../core/pricing/api/pricing.routes';
import { createTemplateRoutes } from '../core/template/interfaces/http/routes/template.routes';
import { createDatabaseRoutes } from '../core/database/interfaces/http/routes/database.routes';
import { createPrinterRoutes, createPrintRoutes } from '../core/printing/interfaces/http/routes/printer.routes';
import { createHubRoutes } from '../core/hub/interfaces/http/routes/hub.routes';
import { createHubMembershipRoutes } from '../core/hub/interfaces/http/routes/hubmembership.routes';
import { createHubContextRoutes } from '../core/hub/interfaces/http/routes/hubcontext.routes';
import { createHubInvitationRoutes } from '../core/hub/interfaces/http/routes/hubinvitation.routes';
import { createMyHubRoutes } from '../core/hub/interfaces/http/routes/myhub.routes';
import { createMyHubAdminRoutes } from '../core/hub/interfaces/http/routes/myhubadmin.routes';
import { createOutletRoutes } from '../core/outlet/interfaces/http/routes/outlet.routes';
import { createPlatformRoutes } from '../core/platform/interfaces/http/routes/platform.routes';
import { createPlanRoutes } from '../core/billing/interfaces/http/routes/plan.routes';
import { createPlatformSubscriptionRoutes, createMerchantSubscriptionRoutes } from '../core/billing/interfaces/http/routes/subscription.routes';

/**
 * Liveness + Mongo readiness, consumed by the compose healthcheck and UptimeRobot.
 *
 * `/health` is the legacy path; both paths share this handler so they can never
 * disagree. Ops docs (`docs/OPS_RUNBOOK.md`) use `/api/health`.
 */
function healthHandler(): RequestHandler {
  return (_req, res) => {
    const mongoOk = mongoose.connection.readyState === 1;
    res.status(mongoOk ? 200 : 503).json({
      status: mongoOk ? 'ok' : 'error',
      mongo: mongoOk ? 'ok' : 'error',
      uptime: Math.round(process.uptime()),
    });
  };
}

export function registerRoutes(app: Express, container: DIContainer): void {
  const health = healthHandler();
  app.get('/health', health);
  app.get('/api/health', health);

  const authController = container.resolve('authController');
  // Credential endpoints only — see `createAuthRateLimiter` for why `/api` is not limited globally.
  const authLimiter = createAuthRateLimiter();
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/hub-login', authLimiter);
  app.use('/api/auth/refresh', authLimiter);
  app.use('/api/auth', createAuthRoutes(authController));

  const tenantController = container.resolve('tenantController');
  app.use('/api/tenants', createTenantRoutes(tenantController));

  const productController = container.resolve('productController');
  app.use('/api/products', createProductRoutes(productController));

  const categoryController = container.resolve('categoryController');
  app.use('/api/categories', createCategoryRoutes(categoryController));

  const familyController = container.resolve('familyController');
  app.use('/api/families', createFamilyRoutes(familyController));

  const modifierController = container.resolve('modifierController');
  app.use('/api/modifiers', createModifierRoutes(modifierController));

  const inventoryController = container.resolve('inventoryController');
  app.use('/api/inventory', createInventoryRoutes(inventoryController));

  const warehouseController = container.resolve('warehouseController');
  app.use('/api/warehouses', createWarehouseRoutes(warehouseController));

  const roleController = container.resolve('roleController');
  app.use('/api/roles', createRoleRoutes(roleController));

  const userController = container.resolve('userController');
  app.use('/api/users', createUserRoutes(userController));

  const permissionController = container.resolve('permissionController');
  app.use('/api/permissions', createPermissionRoutes(permissionController));

  const orderController = container.resolve('orderController');
  const outletMw = createResolveOutlet(container.resolve('outletRepository'));
  const tenantRepository = container.resolve('tenantRepository');
  // POS guards, order matters: the outlet scope check (cheap, sync) still
  // answers before the tenant-status lookup, so a header outside the user's
  // outlets never triggers a DB read. The status gate skips GETs, so reads
  // (reports, the POS alert itself) stay open while mutations are refused.
  const posGuards = [outletMw, createTenantStatusGate(tenantRepository)];
  app.use('/api/orders', createOrderRoutes(orderController, posGuards));

  const shiftController = container.resolve('shiftController');
  app.use('/api/shifts', createShiftRoutes(shiftController, posGuards));

  const paymentController = container.resolve('paymentController');
  app.use('/api/payments', createPaymentRoutes(paymentController, posGuards));

  const reportController = container.resolve('reportController');
  app.use('/api/reports', createReportRoutes(reportController));

  const taxConfigRepo = container.resolve('taxConfigurationRepository');
  app.use('/api/tax', createTaxRoutes(taxConfigRepo));

  const pricingProfileRepo = container.resolve('pricingProfileRepository');
  app.use('/api/pricing-profiles', createPricingProfileRoutes(pricingProfileRepo));

  const discountConfigRepo = container.resolve('discountConfigurationRepository');
  const promoCodeRepo = container.resolve('promoCodeRepository');
  app.use('/api/discount', createDiscountRouter(discountConfigRepo, promoCodeRepo));

  const customerController = container.resolve('customerController');
  app.use('/api/members', createCustomerRoutes(customerController));

  const settingController = container.resolve('settingController');
  app.use('/api/settings', createSettingRoutes(settingController));

  const uploadController = container.resolve('uploadController');
  app.use('/api/upload', createUploadRoutes(uploadController));

  const promotionController = container.resolve('promotionController');
  app.use('/api/promotions', createPromotionRoutes(promotionController));

  const paymentMethodController = container.resolve('paymentMethodController');
  app.use('/api/payment-methods', createPaymentMethodRoutes(paymentMethodController));

  const menuTypeController = container.resolve('menuTypeController');
  app.use('/api/menu-types', createMenuTypeRoutes(menuTypeController));

  const templateController = container.resolve('templateController');
  app.use('/api/templates', createTemplateRoutes(templateController));

  app.use('/api/pricing', createPricingRouter(discountConfigRepo, taxConfigRepo, promoCodeRepo, tenantRepository));

  const databaseController = container.resolve('databaseController');
  app.use('/api/database', createDatabaseRoutes(databaseController));

  const printerController = container.resolve('printerController');
  app.use('/api/printers', createPrinterRoutes(printerController));
  app.use('/api/print', createPrintRoutes(printerController));

  const hubController = container.resolve('hubController');
  const hubInvitationController = container.resolve('hubInvitationController');
  app.use('/api/hubs', createHubRoutes(hubController, hubInvitationController));

  const hubMembershipController = container.resolve('hubMembershipController');
  app.use('/api/hub-memberships', createHubMembershipRoutes(hubMembershipController));
  app.use('/api/hub-context', createHubContextRoutes(hubMembershipController));
  // Hub V2 Fase 20 — the invitee's own invitation (authenticate, not platform).
  app.use('/api/hub-invitations', createHubInvitationRoutes(hubInvitationController));

  // Hub V2 Fase 21 — the member's own hub surface. `hubMemberAccessService` is
  // resolved here (not inside the router) so the guard is a real dependency
  // rather than a container lookup buried in middleware.
  const hubMemberAccessService = container.resolve('hubMemberAccessService');
  app.use('/api/hub', createMyHubRoutes(container.resolve('myHubController'), hubMemberAccessService));
  // Fase 24 — the write half of the same surface, kept in its own router so the
  // boundary between reads and mutations is a file, not a route-matching detail.
  app.use(
    '/api/hub',
    createMyHubAdminRoutes(container.resolve('myHubAdminController'), hubMemberAccessService),
  );

  const outletController = container.resolve('outletController');
  app.use('/api/outlets', createOutletRoutes(outletController));

  const platformController = container.resolve('platformController');
  app.use('/api/platform', createPlatformRoutes(platformController));

  const planController = container.resolve('planController');
  app.use('/api/platform/plans', createPlanRoutes(planController));

  const subscriptionController = container.resolve('subscriptionController');
  app.use('/api/platform', createPlatformSubscriptionRoutes(subscriptionController));
  app.use('/api/tenants', createMerchantSubscriptionRoutes(subscriptionController));
}
