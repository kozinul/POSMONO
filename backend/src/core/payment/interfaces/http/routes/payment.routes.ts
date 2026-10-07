import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { resolveOutlet } from '../../../../../@shared/interfaces/middleware/resolveOutlet';
import { PaymentController } from '../controllers/PaymentController';

export function createPaymentRoutes(paymentController: PaymentController, outletMw: RequestHandler = resolveOutlet): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(paymentController.list.bind(paymentController)));
  router.get('/refundable', authenticate, authorize('payments:read'), asyncHandler(paymentController.listRefundable.bind(paymentController)));
  router.get('/pending', authenticate, asyncHandler(paymentController.listPendingTransfers.bind(paymentController)));
  router.post('/:paymentId/confirm', authenticate, outletMw, asyncHandler(paymentController.confirmTransfer.bind(paymentController)));
  router.post('/:paymentId/cancel', authenticate, outletMw, authorize('payments:write'), asyncHandler(paymentController.cancelTransfer.bind(paymentController)));
  router.post('/qris/initiate', authenticate, outletMw, asyncHandler(paymentController.qrisInitiate.bind(paymentController)));
  router.post('/qris/confirm', authenticate, outletMw, asyncHandler(paymentController.qrisConfirm.bind(paymentController)));
  router.get('/qris/status/:referenceNumber', authenticate, asyncHandler(paymentController.qrisStatus.bind(paymentController)));
  router.post('/qris/test-config', authenticate, asyncHandler(paymentController.qrisTestConfig.bind(paymentController)));
  router.post('/qris/:referenceNumber/cancel', authenticate, outletMw, asyncHandler(paymentController.qrisCancel.bind(paymentController)));
  router.get('/:orderId', authenticate, asyncHandler(paymentController.getByOrder.bind(paymentController)));
  router.post('/pay-cash', authenticate, outletMw, asyncHandler(paymentController.payCash.bind(paymentController)));
  router.post('/process', authenticate, outletMw, asyncHandler(paymentController.processPayment.bind(paymentController)));
  router.post('/:id/refund', authenticate, outletMw, authorize('payments:write'), asyncHandler(paymentController.refund.bind(paymentController)));
  router.post('/split', authenticate, outletMw, asyncHandler(paymentController.splitBill.bind(paymentController)));

  return router;
}
