import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { resolveOutlet } from '../../../../../@shared/interfaces/middleware/resolveOutlet';
import { ShiftController } from '../controllers/ShiftController';

export function createShiftRoutes(shiftController: ShiftController, outletMw: RequestHandler = resolveOutlet): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(shiftController.list.bind(shiftController)));
  router.get('/active', authenticate, asyncHandler(shiftController.getActive.bind(shiftController)));
  router.get('/current', authenticate, outletMw, asyncHandler(shiftController.getCurrent.bind(shiftController)));
  router.get('/carried-bills', authenticate, asyncHandler(shiftController.carriedBills.bind(shiftController)));
  router.post('/open', authenticate, outletMw, asyncHandler(shiftController.open.bind(shiftController)));
  router.post('/:id/close', authenticate, outletMw, asyncHandler(shiftController.close.bind(shiftController)));
  router.post('/:id/pickup', authenticate, outletMw, asyncHandler(shiftController.cashPickup.bind(shiftController)));
  router.put('/:id/sales', authenticate, outletMw, asyncHandler(shiftController.updateSales.bind(shiftController)));

  return router;
}
