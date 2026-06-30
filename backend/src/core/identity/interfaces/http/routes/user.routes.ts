import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { UserController } from '../controllers/UserController';

export function createUserRoutes(userController: UserController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(userController.list.bind(userController)));
  router.get('/:id', authenticate, asyncHandler(userController.getById.bind(userController)));
  router.put('/:id', authenticate, asyncHandler(userController.update.bind(userController)));
  router.post('/:id/deactivate', authenticate, asyncHandler(userController.deactivate.bind(userController)));
  router.post('/:id/activate', authenticate, asyncHandler(userController.activate.bind(userController)));

  return router;
}
