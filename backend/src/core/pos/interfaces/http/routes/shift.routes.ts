import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { resolveOutlet } from '../../../../../@shared/interfaces/middleware/resolveOutlet';
import { ShiftController } from '../controllers/ShiftController';

export function createShiftRoutes(shiftController: ShiftController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(shiftController.list.bind(shiftController)));
  router.get('/active', authenticate, asyncHandler(shiftController.getActive.bind(shiftController)));
  router.get('/current', authenticate, resolveOutlet, asyncHandler(shiftController.getCurrent.bind(shiftController)));
  router.get('/carried-bills', authenticate, asyncHandler(shiftController.carriedBills.bind(shiftController)));
  router.post('/open', authenticate, resolveOutlet, asyncHandler(shiftController.open.bind(shiftController)));
  router.post('/:id/close', authenticate, resolveOutlet, asyncHandler(shiftController.close.bind(shiftController)));
  router.post('/:id/pickup', authenticate, resolveOutlet, asyncHandler(shiftController.cashPickup.bind(shiftController)));
  router.put('/:id/sales', authenticate, resolveOutlet, asyncHandler(shiftController.updateSales.bind(shiftController)));

  return router;
}
