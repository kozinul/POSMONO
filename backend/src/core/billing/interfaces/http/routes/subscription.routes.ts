import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { platformAuthenticate, platformAuthorize } from '../../../../platform/interfaces/http/middleware/platformAuth';
import { SubscriptionController } from '../controllers/SubscriptionController';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';

export function createPlatformSubscriptionRoutes(subscriptionController: SubscriptionController): Router {
  const router = Router();

  router.get('/tenants/:tenantId/subscription', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(subscriptionController.getTenantSubscription.bind(subscriptionController)));
  router.post('/tenants/:tenantId/subscription', platformAuthenticate, platformAuthorize('platform.tenants.manage'), asyncHandler(subscriptionController.assignPlan.bind(subscriptionController)));
  router.post('/tenants/:tenantId/subscription/cancel', platformAuthenticate, platformAuthorize('platform.tenants.manage'), asyncHandler(subscriptionController.cancelSubscription.bind(subscriptionController)));
  router.post('/tenants/:tenantId/subscription/extend', platformAuthenticate, platformAuthorize('platform.tenants.manage'), asyncHandler(subscriptionController.extendSubscription.bind(subscriptionController)));
  router.get('/tenants/:tenantId/subscription/history', platformAuthenticate, platformAuthorize('platform.plans.read'), asyncHandler(subscriptionController.getSubscriptionHistory.bind(subscriptionController)));
  router.get('/tenants/:tenantId/entitlement', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(subscriptionController.getTenantEntitlement.bind(subscriptionController)));
  router.get('/tenants/:tenantId/subscription/invoices', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(subscriptionController.listTenantInvoices.bind(subscriptionController)));
  router.get('/tenants/:tenantId/subscription/invoices/:invoiceId/payments', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(subscriptionController.listTenantInvoicePayments.bind(subscriptionController)));
  router.post('/tenants/:tenantId/subscription/invoices/:invoiceId/pay', platformAuthenticate, platformAuthorize('platform.tenants.manage'), asyncHandler(subscriptionController.recordInvoicePayment.bind(subscriptionController)));
  router.post('/tenants/:tenantId/subscription/invoices/:invoiceId/cancel', platformAuthenticate, platformAuthorize('platform.tenants.manage'), asyncHandler(subscriptionController.cancelInvoice.bind(subscriptionController)));

  return router;
}

export function createMerchantSubscriptionRoutes(subscriptionController: SubscriptionController): Router {
  const router = Router();

  router.get('/current/entitlement', authenticate, authorize('settings.billing.read'), asyncHandler(subscriptionController.getCurrentEntitlement.bind(subscriptionController)));
  router.get('/current/subscription/invoices', authenticate, authorize('settings.billing.read'), asyncHandler(subscriptionController.getCurrentInvoices.bind(subscriptionController)));
  router.get('/current/subscription/payments', authenticate, authorize('settings.billing.read'), asyncHandler(subscriptionController.getCurrentPayments.bind(subscriptionController)));
  router.get('/current/subscription/history', authenticate, authorize('settings.billing.read'), asyncHandler(subscriptionController.getCurrentHistory.bind(subscriptionController)));
  router.post('/current/subscription/renew', authenticate, authorize('settings.billing.read'), asyncHandler(subscriptionController.renewSubscription.bind(subscriptionController)));
  router.post('/current/subscription/invoices/:invoiceId/pay', authenticate, authorize('settings.billing.update'), asyncHandler(subscriptionController.payCurrentInvoice.bind(subscriptionController)));

  return router;
}
