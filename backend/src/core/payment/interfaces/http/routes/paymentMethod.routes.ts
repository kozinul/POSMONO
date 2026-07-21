import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { PaymentMethodController } from '../controllers/PaymentMethodController';

export function createPaymentMethodRoutes(paymentMethodController: PaymentMethodController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(paymentMethodController.list.bind(paymentMethodController)));
  router.get('/active', authenticate, asyncHandler(paymentMethodController.listActive.bind(paymentMethodController)));
  router.get('/:id', authenticate, asyncHandler(paymentMethodController.getById.bind(paymentMethodController)));
  router.post('/', authenticate, asyncHandler(paymentMethodController.create.bind(paymentMethodController)));
  router.put('/:id', authenticate, asyncHandler(paymentMethodController.update.bind(paymentMethodController)));
  router.delete('/:id', authenticate, asyncHandler(paymentMethodController.delete.bind(paymentMethodController)));

  return router;
}
