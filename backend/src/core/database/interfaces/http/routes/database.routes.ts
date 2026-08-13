import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { DatabaseController } from '../controllers/DatabaseController';

export function createDatabaseRoutes(databaseController: DatabaseController): Router {
  const router = Router();

  router.get('/stats', authenticate, authorize('settings:write'), asyncHandler(databaseController.stats.bind(databaseController)));
  router.get('/backup', authenticate, authorize('settings:write'), asyncHandler(databaseController.backup.bind(databaseController)));
  router.post('/restore', authenticate, authorize('settings:write'), asyncHandler(databaseController.restore.bind(databaseController)));
  router.post('/transactions/delete', authenticate, authorize('settings:write'), asyncHandler(databaseController.deleteTransactions.bind(databaseController)));

  return router;
}
