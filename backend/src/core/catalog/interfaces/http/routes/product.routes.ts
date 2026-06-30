import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { ProductController } from '../controllers/ProductController';

export function createProductRoutes(productController: ProductController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(productController.list.bind(productController)));
  router.post('/', authenticate, asyncHandler(productController.create.bind(productController)));
  router.get('/:id', authenticate, asyncHandler(productController.getById.bind(productController)));
  router.put('/:id', authenticate, asyncHandler(productController.update.bind(productController)));
  router.delete('/:id', authenticate, asyncHandler(productController.delete.bind(productController)));

  return router;
}
