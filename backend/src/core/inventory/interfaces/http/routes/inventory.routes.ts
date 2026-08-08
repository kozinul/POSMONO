import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { InventoryController } from '../controllers/InventoryController';

export function createInventoryRoutes(inventoryController: InventoryController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(inventoryController.list.bind(inventoryController)));
  router.get('/movements', authenticate, authorize('inventory:read'), asyncHandler(inventoryController.movements.bind(inventoryController)));
  router.get('/low-stock', authenticate, authorize('inventory:read'), asyncHandler(inventoryController.getLowStock.bind(inventoryController)));
  router.get('/export', authenticate, authorize('inventory:read'), asyncHandler(inventoryController.exportStock.bind(inventoryController)));
  router.get('/:productId', authenticate, asyncHandler(inventoryController.getByProduct.bind(inventoryController)));
  router.post('/stock-in', authenticate, authorize('inventory:write'), asyncHandler(inventoryController.stockIn.bind(inventoryController)));
  router.post('/stock-out', authenticate, authorize('inventory:write'), asyncHandler(inventoryController.stockOut.bind(inventoryController)));
  router.post('/adjust', authenticate, authorize('inventory:write'), asyncHandler(inventoryController.adjust.bind(inventoryController)));
  router.post('/reserve', authenticate, authorize('inventory:write'), asyncHandler(inventoryController.reserve.bind(inventoryController)));
  router.post('/release', authenticate, authorize('inventory:write'), asyncHandler(inventoryController.release.bind(inventoryController)));
  router.post('/import', authenticate, authorize('inventory:write'), asyncHandler(inventoryController.importStock.bind(inventoryController)));

  return router;
}
