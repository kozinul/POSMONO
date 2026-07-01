import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { TaxController } from '../controllers/TaxController';

export function createTaxRoutes(controller: TaxController): Router {
  const router = Router();

  router.get('/configuration', authenticate, asyncHandler(controller.getConfiguration.bind(controller)));
  router.put('/configuration', authenticate, asyncHandler(controller.upsertConfiguration.bind(controller)));
  router.patch('/configuration', authenticate, asyncHandler(controller.updateConfiguration.bind(controller)));
  router.post('/rules', authenticate, asyncHandler(controller.addRule.bind(controller)));
  router.put('/rules/:ruleId', authenticate, asyncHandler(controller.updateRule.bind(controller)));
  router.delete('/rules/:ruleId', authenticate, asyncHandler(controller.deleteRule.bind(controller)));
  router.post('/calculate', authenticate, asyncHandler(controller.calculate.bind(controller)));
  router.get('/history', authenticate, asyncHandler(controller.getCalculationHistory.bind(controller)));

  return router;
}
