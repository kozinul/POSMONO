import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { CustomerController } from '../controllers/CustomerController';

export function createCustomerRoutes(customerController: CustomerController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(customerController.list.bind(customerController)));
  router.get('/search', authenticate, asyncHandler(customerController.search.bind(customerController)));
  router.get('/phone/:phone', authenticate, asyncHandler(customerController.searchByPhone.bind(customerController)));
  router.get('/:id', authenticate, asyncHandler(customerController.getById.bind(customerController)));
  router.post('/', authenticate, asyncHandler(customerController.create.bind(customerController)));
  router.put('/:id', authenticate, asyncHandler(customerController.update.bind(customerController)));
  router.post('/:id/record-visit', authenticate, asyncHandler(customerController.recordVisit.bind(customerController)));
  router.post('/:id/loyalty-points', authenticate, asyncHandler(customerController.addLoyaltyPoints.bind(customerController)));
  router.delete('/:id', authenticate, asyncHandler(customerController.delete.bind(customerController)));

  return router;
}
