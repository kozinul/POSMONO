import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { OutletController } from '../controllers/OutletController';

export function createOutletRoutes(outletController: OutletController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(outletController.list.bind(outletController)));
  router.get('/:id', authenticate, asyncHandler(outletController.getById.bind(outletController)));
  router.post('/', authenticate, authorize('outlet:manage'), asyncHandler(outletController.create.bind(outletController)));
  router.put('/:id', authenticate, authorize('outlet:manage'), asyncHandler(outletController.update.bind(outletController)));
  router.delete('/:id', authenticate, authorize('outlet:manage'), asyncHandler(outletController.delete.bind(outletController)));

  return router;
}
