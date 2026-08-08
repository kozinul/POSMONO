import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { ProductController } from '../controllers/ProductController';

export function createProductRoutes(productController: ProductController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(productController.list.bind(productController)));
  router.post('/', authenticate, authorize('products:write'), asyncHandler(productController.create.bind(productController)));
  router.get('/by-barcode/:barcode', authenticate, asyncHandler(productController.findByBarcode.bind(productController)));
  router.get('/:id', authenticate, asyncHandler(productController.getById.bind(productController)));
  router.put('/:id', authenticate, authorize('products:write'), asyncHandler(productController.update.bind(productController)));
  router.delete('/:id', authenticate, authorize('products:write'), asyncHandler(productController.delete.bind(productController)));

  return router;
}
