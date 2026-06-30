import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { RoleController } from '../controllers/RoleController';

export function createRoleRoutes(roleController: RoleController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(roleController.list.bind(roleController)));
  router.get('/:id', authenticate, asyncHandler(roleController.getById.bind(roleController)));
  router.post('/', authenticate, asyncHandler(roleController.create.bind(roleController)));
  router.put('/:id', authenticate, asyncHandler(roleController.update.bind(roleController)));
  router.delete('/:id', authenticate, asyncHandler(roleController.delete.bind(roleController)));

  return router;
}
