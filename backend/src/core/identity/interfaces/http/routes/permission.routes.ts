import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { PermissionController } from '../controllers/PermissionController';

export function createPermissionRoutes(permissionController: PermissionController): Router {
  const router = Router();
  router.get('/', authenticate, asyncHandler(permissionController.list.bind(permissionController)));
  return router;
}
