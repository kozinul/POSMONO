import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { RoleController } from '../controllers/RoleController';

export function createRoleRoutes(roleController: RoleController): Router {
  const router = Router();

  router.get('/', authenticate, authorize('roles:read'), asyncHandler(roleController.list.bind(roleController)));
  router.get('/:id', authenticate, authorize('roles:read'), asyncHandler(roleController.getById.bind(roleController)));
  router.post('/', authenticate, authorize('roles:write'), asyncHandler(roleController.create.bind(roleController)));
  router.put('/:id', authenticate, authorize('roles:write'), asyncHandler(roleController.update.bind(roleController)));
  router.delete('/:id', authenticate, authorize('roles:write'), asyncHandler(roleController.delete.bind(roleController)));

  return router;
}
