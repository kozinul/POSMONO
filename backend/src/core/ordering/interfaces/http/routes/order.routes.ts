import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { resolveOutlet } from '../../../../../@shared/interfaces/middleware/resolveOutlet';
import { OrderController } from '../controllers/OrderController';

export function createOrderRoutes(orderController: OrderController, outletMw: RequestHandler = resolveOutlet): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(orderController.list.bind(orderController)));
  router.get('/:id', authenticate, asyncHandler(orderController.getById.bind(orderController)));
  router.get('/:id/invoice', authenticate, asyncHandler(orderController.invoice.bind(orderController)));
  router.post('/', authenticate, outletMw, asyncHandler(orderController.create.bind(orderController)));
  router.put('/:id', authenticate, outletMw, asyncHandler(orderController.update.bind(orderController)));
  router.post('/:id/pay', authenticate, outletMw, asyncHandler(orderController.pay.bind(orderController)));
  router.post('/:id/void', authenticate, outletMw, asyncHandler(orderController.voidOrder.bind(orderController)));
  router.post('/:id/close-bill', authenticate, outletMw, asyncHandler(orderController.closeBill.bind(orderController)));
  router.post('/:id/void-item', authenticate, outletMw, asyncHandler(orderController.voidItem.bind(orderController)));
  router.post('/:id/void-payment', authenticate, outletMw, asyncHandler(orderController.voidPayment.bind(orderController)));
  router.post('/:id/void-rollback', authenticate, outletMw, asyncHandler(orderController.voidAndRollback.bind(orderController)));
  router.post('/:id/topay', authenticate, outletMw, asyncHandler(orderController.topay.bind(orderController)));
  router.post('/:id/refund', authenticate, outletMw, asyncHandler(orderController.refund.bind(orderController)));
  router.post('/:id/apply-discount', authenticate, outletMw, asyncHandler(orderController.applyDiscount.bind(orderController)));
  router.post('/:id/service-charge', authenticate, outletMw, asyncHandler(orderController.setServiceCharge.bind(orderController)));
  router.patch('/:id/reopen', authenticate, outletMw, asyncHandler(orderController.reopen.bind(orderController)));
  router.post('/:id/hold', authenticate, outletMw, asyncHandler(orderController.hold.bind(orderController)));
  router.patch('/:id/recall', authenticate, outletMw, asyncHandler(orderController.recall.bind(orderController)));
  router.put('/:id/items', authenticate, outletMw, asyncHandler(orderController.replaceItems.bind(orderController)));
  router.post('/:id/split-item', authenticate, outletMw, asyncHandler(orderController.splitItem.bind(orderController)));
  router.delete('/:id/item', authenticate, outletMw, asyncHandler(orderController.removeItem.bind(orderController)));
  router.patch('/:id/item/quantity', authenticate, outletMw, asyncHandler(orderController.updateItemQuantity.bind(orderController)));

  return router;
}
