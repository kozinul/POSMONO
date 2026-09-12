import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { resolveOutlet } from '../../../../../@shared/interfaces/middleware/resolveOutlet';
import { OrderController } from '../controllers/OrderController';

export function createOrderRoutes(orderController: OrderController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(orderController.list.bind(orderController)));
  router.get('/:id', authenticate, asyncHandler(orderController.getById.bind(orderController)));
  router.get('/:id/invoice', authenticate, asyncHandler(orderController.invoice.bind(orderController)));
  router.post('/', authenticate, resolveOutlet, asyncHandler(orderController.create.bind(orderController)));
  router.put('/:id', authenticate, resolveOutlet, asyncHandler(orderController.update.bind(orderController)));
  router.post('/:id/pay', authenticate, resolveOutlet, asyncHandler(orderController.pay.bind(orderController)));
  router.post('/:id/void', authenticate, resolveOutlet, asyncHandler(orderController.voidOrder.bind(orderController)));
  router.post('/:id/close-bill', authenticate, resolveOutlet, asyncHandler(orderController.closeBill.bind(orderController)));
  router.post('/:id/void-item', authenticate, resolveOutlet, asyncHandler(orderController.voidItem.bind(orderController)));
  router.post('/:id/void-payment', authenticate, resolveOutlet, asyncHandler(orderController.voidPayment.bind(orderController)));
  router.post('/:id/void-rollback', authenticate, resolveOutlet, asyncHandler(orderController.voidAndRollback.bind(orderController)));
  router.post('/:id/topay', authenticate, resolveOutlet, asyncHandler(orderController.topay.bind(orderController)));
  router.post('/:id/refund', authenticate, resolveOutlet, asyncHandler(orderController.refund.bind(orderController)));
  router.post('/:id/apply-discount', authenticate, resolveOutlet, asyncHandler(orderController.applyDiscount.bind(orderController)));
  router.post('/:id/service-charge', authenticate, resolveOutlet, asyncHandler(orderController.setServiceCharge.bind(orderController)));
  router.patch('/:id/reopen', authenticate, resolveOutlet, asyncHandler(orderController.reopen.bind(orderController)));
  router.post('/:id/hold', authenticate, resolveOutlet, asyncHandler(orderController.hold.bind(orderController)));
  router.patch('/:id/recall', authenticate, resolveOutlet, asyncHandler(orderController.recall.bind(orderController)));
  router.put('/:id/items', authenticate, resolveOutlet, asyncHandler(orderController.replaceItems.bind(orderController)));
  router.post('/:id/split-item', authenticate, resolveOutlet, asyncHandler(orderController.splitItem.bind(orderController)));
  router.delete('/:id/item', authenticate, resolveOutlet, asyncHandler(orderController.removeItem.bind(orderController)));
  router.patch('/:id/item/quantity', authenticate, resolveOutlet, asyncHandler(orderController.updateItemQuantity.bind(orderController)));

  return router;
}
