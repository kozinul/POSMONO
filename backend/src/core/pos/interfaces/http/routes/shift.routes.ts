import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { ShiftController } from '../controllers/ShiftController';

export function createShiftRoutes(shiftController: ShiftController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(shiftController.list.bind(shiftController)));
  router.get('/current', authenticate, asyncHandler(shiftController.getCurrent.bind(shiftController)));
  router.post('/open', authenticate, asyncHandler(shiftController.open.bind(shiftController)));
  router.post('/:id/close', authenticate, asyncHandler(shiftController.close.bind(shiftController)));

  return router;
}
