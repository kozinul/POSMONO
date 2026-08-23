import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { PaymentController } from '../controllers/PaymentController';

export function createPaymentRoutes(paymentController: PaymentController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(paymentController.list.bind(paymentController)));
  router.get('/refundable', authenticate, authorize('payments:read'), asyncHandler(paymentController.listRefundable.bind(paymentController)));
  router.post('/qris/initiate', authenticate, asyncHandler(paymentController.qrisInitiate.bind(paymentController)));
  router.post('/qris/confirm', authenticate, asyncHandler(paymentController.qrisConfirm.bind(paymentController)));
  router.get('/qris/status/:referenceNumber', authenticate, asyncHandler(paymentController.qrisStatus.bind(paymentController)));
  router.post('/qris/test-config', authenticate, asyncHandler(paymentController.qrisTestConfig.bind(paymentController)));
  router.post('/qris/:referenceNumber/cancel', authenticate, asyncHandler(paymentController.qrisCancel.bind(paymentController)));
  router.get('/:orderId', authenticate, asyncHandler(paymentController.getByOrder.bind(paymentController)));
  router.post('/pay-cash', authenticate, asyncHandler(paymentController.payCash.bind(paymentController)));
  router.post('/process', authenticate, asyncHandler(paymentController.processPayment.bind(paymentController)));
  router.post('/:id/refund', authenticate, authorize('payments:write'), asyncHandler(paymentController.refund.bind(paymentController)));
  router.post('/split', authenticate, asyncHandler(paymentController.splitBill.bind(paymentController)));

  return router;
}
