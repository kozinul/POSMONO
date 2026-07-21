import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { FamilyController } from '../controllers/FamilyController';

export function createFamilyRoutes(familyController: FamilyController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(familyController.list.bind(familyController)));
  router.post('/', authenticate, asyncHandler(familyController.create.bind(familyController)));
  router.put('/:id', authenticate, asyncHandler(familyController.update.bind(familyController)));
  router.delete('/:id', authenticate, asyncHandler(familyController.delete.bind(familyController)));

  return router;
}
