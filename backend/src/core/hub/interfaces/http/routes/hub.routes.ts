import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { platformAuthenticate, platformAuthorize } from '../../../../../core/platform/interfaces/http/middleware/platformAuth';
import { HubController } from '../controllers/HubController';

export function createHubRoutes(hubController: HubController): Router {
  const router = Router();

  router.get('/', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubController.list.bind(hubController)));
  router.get('/:id', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubController.getById.bind(hubController)));
  router.post('/', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubController.create.bind(hubController)));
  router.put('/:id', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubController.update.bind(hubController)));
  router.delete('/:id', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubController.delete.bind(hubController)));
  router.post('/:hubId/tenants/:tenantId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubController.assignTenant.bind(hubController)));
  router.delete('/:hubId/tenants/:tenantId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubController.unassignTenant.bind(hubController)));
  router.get('/:hubId/tenants', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubController.listTenants.bind(hubController)));

  return router;
}