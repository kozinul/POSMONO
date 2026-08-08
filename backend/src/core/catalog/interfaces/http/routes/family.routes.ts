import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { FamilyController } from '../controllers/FamilyController';

export function createFamilyRoutes(familyController: FamilyController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(familyController.list.bind(familyController)));
  router.get('/by-menu-type/:menuType', authenticate, asyncHandler(familyController.listByMenuType.bind(familyController)));
  router.post('/', authenticate, authorize('products:write'), asyncHandler(familyController.create.bind(familyController)));
  router.put('/:id', authenticate, authorize('products:write'), asyncHandler(familyController.update.bind(familyController)));
  router.delete('/:id', authenticate, authorize('products:write'), asyncHandler(familyController.delete.bind(familyController)));

  return router;
}
