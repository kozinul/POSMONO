import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { platformAuthenticate, platformAuthorize } from '../../../../platform/interfaces/http/middleware/platformAuth';
import { PlanController } from '../controllers/PlanController';

export function createPlanRoutes(planController: PlanController): Router {
  const router = Router();

  router.get('/', platformAuthenticate, platformAuthorize('platform.plans.read'), asyncHandler(planController.list.bind(planController)));
  router.get('/:id', platformAuthenticate, platformAuthorize('platform.plans.read'), asyncHandler(planController.getById.bind(planController)));
  router.post('/', platformAuthenticate, platformAuthorize('platform.plans.manage'), asyncHandler(planController.create.bind(planController)));
  router.put('/:id', platformAuthenticate, platformAuthorize('platform.plans.manage'), asyncHandler(planController.update.bind(planController)));
  router.delete('/:id', platformAuthenticate, platformAuthorize('platform.plans.manage'), asyncHandler(planController.delete.bind(planController)));

  return router;
}
