import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { PaymentController } from '../controllers/PaymentController';

export function createPaymentRoutes(paymentController: PaymentController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(paymentController.list.bind(paymentController)));
  router.get('/:orderId', authenticate, asyncHandler(paymentController.getByOrder.bind(paymentController)));
  router.post('/pay-cash', authenticate, asyncHandler(paymentController.payCash.bind(paymentController)));

  return router;
}
