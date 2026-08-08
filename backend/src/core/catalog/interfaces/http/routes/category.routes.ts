import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { CategoryController } from '../controllers/CategoryController';

export function createCategoryRoutes(categoryController: CategoryController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(categoryController.list.bind(categoryController)));
  router.get('/by-family/:familyId', authenticate, asyncHandler(categoryController.listByFamily.bind(categoryController)));
  router.post('/', authenticate, authorize('products:write'), asyncHandler(categoryController.create.bind(categoryController)));
  router.put('/:id', authenticate, authorize('products:write'), asyncHandler(categoryController.update.bind(categoryController)));
  router.delete('/:id', authenticate, authorize('products:write'), asyncHandler(categoryController.delete.bind(categoryController)));

  return router;
}
