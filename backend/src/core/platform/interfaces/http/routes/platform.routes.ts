import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { platformAuthenticate } from '../middleware/platformAuth';
import { platformAuthorize } from '../middleware/platformAuth';
import { PlatformController } from '../controllers/PlatformController';

export function createPlatformRoutes(platformController: PlatformController): Router {
  const router = Router();

  router.get('/health', platformAuthenticate, asyncHandler(platformController.health.bind(platformController)));

  router.get('/hubs', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.listHubs.bind(platformController)));
  router.get('/hubs/:hubId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.getHub.bind(platformController)));

  router.get('/tenants', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.listTenants.bind(platformController)));
  router.get('/tenants/:tenantId', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.getTenant.bind(platformController)));

  router.get('/outlets', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.listOutlets.bind(platformController)));

  router.get('/shifts/summary', platformAuthenticate, platformAuthorize('platform.reports.read'), asyncHandler(platformController.shiftsSummary.bind(platformController)));
  router.get('/payments/summary', platformAuthenticate, platformAuthorize('platform.reports.read'), asyncHandler(platformController.paymentsSummary.bind(platformController)));

  return router;
}