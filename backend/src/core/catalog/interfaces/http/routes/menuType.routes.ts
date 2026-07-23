import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { MenuTypeController } from '../controllers/MenuTypeController';

export function createMenuTypeRoutes(menuTypeController: MenuTypeController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(menuTypeController.list.bind(menuTypeController)));
  router.post('/', authenticate, asyncHandler(menuTypeController.create.bind(menuTypeController)));
  router.put('/:id', authenticate, asyncHandler(menuTypeController.update.bind(menuTypeController)));
  router.put('/:id/rename', authenticate, asyncHandler(menuTypeController.rename.bind(menuTypeController)));
  router.delete('/:id', authenticate, asyncHandler(menuTypeController.delete.bind(menuTypeController)));

  return router;
}
