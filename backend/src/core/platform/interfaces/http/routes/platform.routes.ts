import { Router } from 'express';
import { PERMISSIONS } from '@posmono/shared';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { platformAuthenticate } from '../middleware/platformAuth';
import { platformAuthorize } from '../middleware/platformAuth';
import { PlatformController } from '../controllers/PlatformController';

const { PLATFORM_HUBS_MANAGE } = PERMISSIONS;

export function createPlatformRoutes(platformController: PlatformController): Router {
  const router = Router();

  router.get('/health', platformAuthenticate, asyncHandler(platformController.health.bind(platformController)));

  router.get('/audit', platformAuthenticate, platformAuthorize('platform.audit.read'), asyncHandler(platformController.listAudit.bind(platformController)));
  router.get('/provisioning-runs', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.listProvisioningRuns.bind(platformController)));

  router.get('/hubs', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(platformController.listHubs.bind(platformController)));
  router.get('/hubs/:hubId', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(platformController.getHub.bind(platformController)));
  router.get('/hubs/:hubId/consolidated', platformAuthenticate, platformAuthorize('platform.reports.read'), asyncHandler(platformController.consolidated.bind(platformController)));
  router.get('/hubs/:hubId/overview', platformAuthenticate, platformAuthorize('platform.reports.read'), asyncHandler(platformController.overview.bind(platformController)));

  router.get('/tenants', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.listTenants.bind(platformController)));
  router.get('/tenants/:tenantId', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.getTenant.bind(platformController)));
  router.put('/tenants/:tenantId', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(platformController.updateTenant.bind(platformController)));
  router.put('/tenants/:tenantId/users/:userId', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(platformController.updateTenantUser.bind(platformController)));
  router.delete('/tenants/:tenantId/users/:userId', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(platformController.deleteTenantUser.bind(platformController)));
  router.delete('/tenants/:tenantId', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(platformController.deleteTenant.bind(platformController)));
  router.post('/tenants/:tenantId/status', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(platformController.updateTenantStatus.bind(platformController)));
  router.post('/tenants/:tenantId/extend', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(platformController.extendTenantSubscription.bind(platformController)));
  router.post('/provision/tenant', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(platformController.provisionTenant.bind(platformController)));

  router.get('/users', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.listUsers.bind(platformController)));
  router.get('/outlets', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.listOutlets.bind(platformController)));
  router.post('/outlets', platformAuthenticate, platformAuthorize('outlet:manage'), asyncHandler(platformController.createOutlet.bind(platformController)));
  router.put('/outlets/:outletId', platformAuthenticate, platformAuthorize('outlet:manage'), asyncHandler(platformController.updateOutlet.bind(platformController)));
  router.delete('/outlets/:outletId', platformAuthenticate, platformAuthorize('outlet:manage'), asyncHandler(platformController.deleteOutlet.bind(platformController)));

  router.get('/shifts/summary', platformAuthenticate, platformAuthorize('platform.reports.read'), asyncHandler(platformController.shiftsSummary.bind(platformController)));
  router.get('/payments/summary', platformAuthenticate, platformAuthorize('platform.reports.read'), asyncHandler(platformController.paymentsSummary.bind(platformController)));

  return router;
}