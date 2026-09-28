import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { platformAuthenticate } from '../middleware/platformAuth';
import { platformAuthorize } from '../middleware/platformAuth';
import { PlatformController } from '../controllers/PlatformController';

export function createPlatformRoutes(platformController: PlatformController): Router {
  const router = Router();

  router.get('/health', platformAuthenticate, asyncHandler(platformController.health.bind(platformController)));

  router.get('/audit', platformAuthenticate, platformAuthorize('platform.audit.read'), asyncHandler(platformController.listAudit.bind(platformController)));
  router.get('/provisioning-runs', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.listProvisioningRuns.bind(platformController)));

  router.get('/hubs', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.listHubs.bind(platformController)));
  router.get('/hubs/:hubId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.getHub.bind(platformController)));
  router.get('/hubs/:hubId/consolidated', platformAuthenticate, platformAuthorize('platform.reports.read'), asyncHandler(platformController.consolidated.bind(platformController)));

  router.get('/tenants', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.listTenants.bind(platformController)));
  router.get('/tenants/:tenantId', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.getTenant.bind(platformController)));
  router.put('/tenants/:tenantId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.updateTenant.bind(platformController)));
  router.put('/tenants/:tenantId/users/:userId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.updateTenantUser.bind(platformController)));
  router.delete('/tenants/:tenantId/users/:userId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.deleteTenantUser.bind(platformController)));
  router.delete('/tenants/:tenantId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.deleteTenant.bind(platformController)));
  router.post('/tenants/:tenantId/status', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.updateTenantStatus.bind(platformController)));
  router.post('/tenants/:tenantId/extend', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.extendTenantSubscription.bind(platformController)));
  router.post('/provision/tenant', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(platformController.provisionTenant.bind(platformController)));

  router.get('/users', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.listUsers.bind(platformController)));
  router.get('/outlets', platformAuthenticate, platformAuthorize('platform.tenants.read'), asyncHandler(platformController.listOutlets.bind(platformController)));
  router.post('/outlets', platformAuthenticate, platformAuthorize('outlet:manage'), asyncHandler(platformController.createOutlet.bind(platformController)));
  router.put('/outlets/:outletId', platformAuthenticate, platformAuthorize('outlet:manage'), asyncHandler(platformController.updateOutlet.bind(platformController)));
  router.delete('/outlets/:outletId', platformAuthenticate, platformAuthorize('outlet:manage'), asyncHandler(platformController.deleteOutlet.bind(platformController)));

  router.get('/shifts/summary', platformAuthenticate, platformAuthorize('platform.reports.read'), asyncHandler(platformController.shiftsSummary.bind(platformController)));
  router.get('/payments/summary', platformAuthenticate, platformAuthorize('platform.reports.read'), asyncHandler(platformController.paymentsSummary.bind(platformController)));

  return router;
}