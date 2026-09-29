import { Router } from 'express';
import { PERMISSIONS } from '@posmono/shared';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { platformAuthenticate, platformAuthorize } from '../../../../../core/platform/interfaces/http/middleware/platformAuth';
import { HubController } from '../controllers/HubController';

const { PLATFORM_HUBS_MANAGE } = PERMISSIONS;

export function createHubRoutes(hubController: HubController): Router {
  const router = Router();

  router.get('/', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubController.list.bind(hubController)));
  router.get('/:id', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubController.getById.bind(hubController)));
  router.post('/', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubController.create.bind(hubController)));
  router.put('/:id', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubController.update.bind(hubController)));
  router.delete('/:id', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubController.delete.bind(hubController)));
  router.post('/:hubId/tenants/:tenantId', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubController.assignTenant.bind(hubController)));
  router.delete('/:hubId/tenants/:tenantId', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubController.unassignTenant.bind(hubController)));
  router.get('/:hubId/tenants', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubController.listTenants.bind(hubController)));

  return router;
}