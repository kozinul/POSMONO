import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { HubController } from '../controllers/HubController';

export function createHubRoutes(hubController: HubController): Router {
  const router = Router();

  router.get('/', authenticate, authorize('hub:manage'), asyncHandler(hubController.list.bind(hubController)));
  router.get('/:id', authenticate, authorize('hub:manage'), asyncHandler(hubController.getById.bind(hubController)));
  router.post('/', authenticate, authorize('hub:manage'), asyncHandler(hubController.create.bind(hubController)));
  router.put('/:id', authenticate, authorize('hub:manage'), asyncHandler(hubController.update.bind(hubController)));
  router.delete('/:id', authenticate, authorize('hub:manage'), asyncHandler(hubController.delete.bind(hubController)));
  router.post('/:hubId/tenants/:tenantId', authenticate, authorize('hub:manage'), asyncHandler(hubController.assignTenant.bind(hubController)));
  router.delete('/:hubId/tenants/:tenantId', authenticate, authorize('hub:manage'), asyncHandler(hubController.unassignTenant.bind(hubController)));
  router.get('/:hubId/tenants', authenticate, authorize('hub:manage'), asyncHandler(hubController.listTenants.bind(hubController)));

  return router;
}
