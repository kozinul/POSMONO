import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { InventoryController } from '../controllers/InventoryController';

export function createInventoryRoutes(inventoryController: InventoryController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(inventoryController.list.bind(inventoryController)));
  router.get('/movements', authenticate, asyncHandler(inventoryController.movements.bind(inventoryController)));
  router.get('/low-stock', authenticate, asyncHandler(inventoryController.getLowStock.bind(inventoryController)));
  router.get('/export', authenticate, asyncHandler(inventoryController.exportStock.bind(inventoryController)));
  router.get('/:productId', authenticate, asyncHandler(inventoryController.getByProduct.bind(inventoryController)));
  router.post('/stock-in', authenticate, asyncHandler(inventoryController.stockIn.bind(inventoryController)));
  router.post('/stock-out', authenticate, asyncHandler(inventoryController.stockOut.bind(inventoryController)));
  router.post('/adjust', authenticate, asyncHandler(inventoryController.adjust.bind(inventoryController)));
  router.post('/reserve', authenticate, asyncHandler(inventoryController.reserve.bind(inventoryController)));
  router.post('/release', authenticate, asyncHandler(inventoryController.release.bind(inventoryController)));
  router.post('/import', authenticate, asyncHandler(inventoryController.importStock.bind(inventoryController)));

  return router;
}
