import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { SettingController } from '../controllers/SettingController';

export function createSettingRoutes(settingController: SettingController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(settingController.getAll.bind(settingController)));
  router.get('/:key', authenticate, asyncHandler(settingController.getByKey.bind(settingController)));
  router.put('/', authenticate, asyncHandler(settingController.set.bind(settingController)));
  router.put('/bulk', authenticate, asyncHandler(settingController.setMany.bind(settingController)));
  router.delete('/:key', authenticate, asyncHandler(settingController.delete.bind(settingController)));

  return router;
}
