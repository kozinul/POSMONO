import { Express } from 'express';
import type { DIContainer } from './container';
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

export function registerRoutes(app: Express, container: DIContainer): void {
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const authController = container.resolve('authController');
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
  app.use('/api/orders', createOrderRoutes(orderController));

  const shiftController = container.resolve('shiftController');
  app.use('/api/shifts', createShiftRoutes(shiftController));

  const paymentController = container.resolve('paymentController');
  app.use('/api/payments', createPaymentRoutes(paymentController));

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
}
