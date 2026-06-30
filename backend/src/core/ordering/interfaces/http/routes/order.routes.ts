import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { OrderController } from '../controllers/OrderController';

export function createOrderRoutes(orderController: OrderController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(orderController.list.bind(orderController)));
  router.get('/:id', authenticate, asyncHandler(orderController.getById.bind(orderController)));
  router.post('/', authenticate, asyncHandler(orderController.create.bind(orderController)));

  return router;
}
