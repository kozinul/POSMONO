import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { TenantController } from '../controllers/TenantController';

export function createTenantRoutes(tenantController: TenantController): Router {
  const router = Router();

  router.get('/slug/:slug', asyncHandler(tenantController.getBySlug.bind(tenantController)));
  router.post('/', authenticate, asyncHandler(tenantController.create.bind(tenantController)));
  router.get('/current', authenticate, asyncHandler(tenantController.getCurrent.bind(tenantController)));
  router.patch('/current/settings', authenticate, asyncHandler(tenantController.updateSettings.bind(tenantController)));

  return router;
}
