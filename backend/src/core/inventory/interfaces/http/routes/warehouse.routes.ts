import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { WarehouseController } from '../controllers/WarehouseController';

export function createWarehouseRoutes(warehouseController: WarehouseController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(warehouseController.list.bind(warehouseController)));
  router.get('/:id', authenticate, asyncHandler(warehouseController.getById.bind(warehouseController)));
  router.post('/', authenticate, asyncHandler(warehouseController.create.bind(warehouseController)));
  router.put('/:id', authenticate, asyncHandler(warehouseController.update.bind(warehouseController)));
  router.delete('/:id', authenticate, asyncHandler(warehouseController.delete.bind(warehouseController)));

  return router;
}
