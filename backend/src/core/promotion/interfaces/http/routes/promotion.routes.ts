import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { PromotionController } from '../controllers/PromotionController';

export function createPromotionRoutes(promotionController: PromotionController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(promotionController.list.bind(promotionController)));
  router.get('/:id', authenticate, asyncHandler(promotionController.getById.bind(promotionController)));
  router.post('/', authenticate, asyncHandler(promotionController.create.bind(promotionController)));
  router.put('/:id', authenticate, asyncHandler(promotionController.update.bind(promotionController)));
  router.post('/validate', authenticate, asyncHandler(promotionController.validate.bind(promotionController)));
  router.post('/apply', authenticate, asyncHandler(promotionController.apply.bind(promotionController)));
  router.delete('/:id', authenticate, asyncHandler(promotionController.delete.bind(promotionController)));

  return router;
}
