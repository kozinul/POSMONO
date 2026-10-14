import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { resolveOutlet } from '../../../../../@shared/interfaces/middleware/resolveOutlet';
import { OrderController } from '../controllers/OrderController';

export function createOrderRoutes(
  orderController: OrderController,
  outletMw: RequestHandler | RequestHandler[] = resolveOutlet,
): Router {
  const router = Router();

  router.get('/', authenticate, authorize('orders:read'), asyncHandler(orderController.list.bind(orderController)));
  router.get('/:id', authenticate, authorize('orders:read'), asyncHandler(orderController.getById.bind(orderController)));
  router.get('/:id/invoice', authenticate, authorize('orders:read'), asyncHandler(orderController.invoice.bind(orderController)));
  router.post('/', authenticate, authorize('orders:write'), outletMw, asyncHandler(orderController.create.bind(orderController)));
  router.put('/:id', authenticate, authorize('orders:write'), outletMw, asyncHandler(orderController.update.bind(orderController)));
  // Money-out operations require payments:write, mirroring /payments/:id/refund.
  router.post('/:id/pay', authenticate, authorize('payments:write'), outletMw, asyncHandler(orderController.pay.bind(orderController)));
  // Void routes are intentionally NOT authorize-guarded: a cashier without the
  // void permission must still reach VoidApprovalService and be prompted for a
  // manager PIN. Guarding here would 403 them before the PIN flow can run.
  router.post('/:id/void', authenticate, outletMw, asyncHandler(orderController.voidOrder.bind(orderController)));
  router.post('/:id/close-bill', authenticate, authorize('orders:write'), outletMw, asyncHandler(orderController.closeBill.bind(orderController)));
  router.post('/:id/void-item', authenticate, outletMw, asyncHandler(orderController.voidItem.bind(orderController)));
  router.post('/:id/void-payment', authenticate, outletMw, asyncHandler(orderController.voidPayment.bind(orderController)));
  router.post('/:id/void-rollback', authenticate, outletMw, asyncHandler(orderController.voidAndRollback.bind(orderController)));
  router.post('/:id/topay', authenticate, authorize('payments:write'), outletMw, asyncHandler(orderController.topay.bind(orderController)));
  router.post('/:id/refund', authenticate, authorize('payments:write'), outletMw, asyncHandler(orderController.refund.bind(orderController)));
  router.post('/:id/apply-discount', authenticate, authorize('orders:cancel'), outletMw, asyncHandler(orderController.applyDiscount.bind(orderController)));
  router.post('/:id/service-charge', authenticate, authorize('orders:cancel'), outletMw, asyncHandler(orderController.setServiceCharge.bind(orderController)));
  router.patch('/:id/reopen', authenticate, authorize('orders:cancel'), outletMw, asyncHandler(orderController.reopen.bind(orderController)));
  router.post('/:id/hold', authenticate, authorize('orders:write'), outletMw, asyncHandler(orderController.hold.bind(orderController)));
  router.patch('/:id/recall', authenticate, authorize('orders:write'), outletMw, asyncHandler(orderController.recall.bind(orderController)));
  router.put('/:id/items', authenticate, authorize('orders:write'), outletMw, asyncHandler(orderController.replaceItems.bind(orderController)));
  router.post('/:id/split-item', authenticate, authorize('orders:write'), outletMw, asyncHandler(orderController.splitItem.bind(orderController)));
  router.delete('/:id/item', authenticate, authorize('orders:write'), outletMw, asyncHandler(orderController.removeItem.bind(orderController)));
  router.patch('/:id/item/quantity', authenticate, authorize('orders:write'), outletMw, asyncHandler(orderController.updateItemQuantity.bind(orderController)));

  return router;
}
