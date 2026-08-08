import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { UserController } from '../controllers/UserController';

export function createUserRoutes(userController: UserController): Router {
  const router = Router();

  router.get('/', authenticate, authorize('users:read'), asyncHandler(userController.list.bind(userController)));
  router.get('/:id', authenticate, authorize('users:read'), asyncHandler(userController.getById.bind(userController)));
  router.post('/', authenticate, authorize('users:write'), asyncHandler(userController.create.bind(userController)));
  router.put('/:id', authenticate, authorize('users:write'), asyncHandler(userController.update.bind(userController)));
  router.delete('/:id', authenticate, authorize('users:write'), asyncHandler(userController.delete.bind(userController)));
  router.post('/:id/deactivate', authenticate, authorize('users:write'), asyncHandler(userController.deactivate.bind(userController)));
  router.post('/:id/activate', authenticate, authorize('users:write'), asyncHandler(userController.activate.bind(userController)));

  return router;
}
