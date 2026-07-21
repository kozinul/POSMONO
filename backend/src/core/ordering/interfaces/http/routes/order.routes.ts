import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { OrderController } from '../controllers/OrderController';

export function createOrderRoutes(orderController: OrderController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(orderController.list.bind(orderController)));
  router.get('/:id', authenticate, asyncHandler(orderController.getById.bind(orderController)));
  router.post('/', authenticate, asyncHandler(orderController.create.bind(orderController)));
  router.put('/:id', authenticate, asyncHandler(orderController.update.bind(orderController)));
  router.post('/:id/pay', authenticate, asyncHandler(orderController.pay.bind(orderController)));
  router.post('/:id/void', authenticate, asyncHandler(orderController.voidOrder.bind(orderController)));
  router.post('/:id/void-item', authenticate, asyncHandler(orderController.voidItem.bind(orderController)));
  router.post('/:id/void-payment', authenticate, asyncHandler(orderController.voidPayment.bind(orderController)));
  router.post('/:id/void-rollback', authenticate, asyncHandler(orderController.voidAndRollback.bind(orderController)));
  router.patch('/:id/reopen', authenticate, asyncHandler(orderController.reopen.bind(orderController)));
  router.post('/:id/split-item', authenticate, asyncHandler(orderController.splitItem.bind(orderController)));
  router.delete('/:id/item', authenticate, asyncHandler(orderController.removeItem.bind(orderController)));
  router.patch('/:id/item/quantity', authenticate, asyncHandler(orderController.updateItemQuantity.bind(orderController)));

  return router;
}
