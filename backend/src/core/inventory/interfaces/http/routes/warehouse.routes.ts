import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { WarehouseController } from '../controllers/WarehouseController';

export function createWarehouseRoutes(warehouseController: WarehouseController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(warehouseController.list.bind(warehouseController)));
  router.get('/:id', authenticate, asyncHandler(warehouseController.getById.bind(warehouseController)));
  router.post('/', authenticate, authorize('inventory:write'), asyncHandler(warehouseController.create.bind(warehouseController)));
  router.put('/:id', authenticate, authorize('inventory:write'), asyncHandler(warehouseController.update.bind(warehouseController)));
  router.delete('/:id', authenticate, authorize('inventory:write'), asyncHandler(warehouseController.delete.bind(warehouseController)));

  return router;
}
