import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { ModifierController } from '../controllers/ModifierController';

export function createModifierRoutes(modifierController: ModifierController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(modifierController.list.bind(modifierController)));
  router.get('/global', authenticate, asyncHandler(modifierController.listGlobal.bind(modifierController)));
  router.get('/product/:productId', authenticate, asyncHandler(modifierController.listByProduct.bind(modifierController)));
  router.get('/family/:familyId', authenticate, asyncHandler(modifierController.listByFamily.bind(modifierController)));
  router.post('/', authenticate, asyncHandler(modifierController.create.bind(modifierController)));
  router.put('/:id', authenticate, asyncHandler(modifierController.update.bind(modifierController)));
  router.delete('/:id', authenticate, asyncHandler(modifierController.delete.bind(modifierController)));

  return router;
}
