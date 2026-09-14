import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { platformAuthenticate, platformAuthorize } from '../../../../platform/interfaces/http/middleware/platformAuth';
import { SubscriptionController } from '../controllers/SubscriptionController';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';

export function createPlatformSubscriptionRoutes(subscriptionController: SubscriptionController): Router {
  const router = Router();

  router.get('/tenants/:tenantId/subscription', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(subscriptionController.getTenantSubscription.bind(subscriptionController)));
  router.post('/tenants/:tenantId/subscription', platformAuthenticate, platformAuthorize('platform.tenants.manage'), asyncHandler(subscriptionController.assignPlan.bind(subscriptionController)));
  router.post('/tenants/:tenantId/subscription/cancel', platformAuthenticate, platformAuthorize('platform.tenants.manage'), asyncHandler(subscriptionController.cancelSubscription.bind(subscriptionController)));
  router.get('/tenants/:tenantId/entitlement', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(subscriptionController.getTenantEntitlement.bind(subscriptionController)));

  return router;
}

export function createMerchantEntitlementRoutes(subscriptionController: SubscriptionController): Router {
  const router = Router();

  router.get('/current/entitlement', authenticate, asyncHandler(subscriptionController.getCurrentEntitlement.bind(subscriptionController)));

  return router;
}
