import { Router } from 'express';
import { asyncHandler } from '../../../@shared/interfaces/middleware/asyncHandler';
import { IPricingProfileRepository } from '../infrastructure/persistence/IPricingProfileRepository';
import { PricingProfileController } from './pricingProfile.controller';

export function createPricingProfileRoutes(repo: IPricingProfileRepository): Router {
  const router = Router();
  const ctrl = new PricingProfileController(repo);

  router.get('/', asyncHandler(ctrl.list.bind(ctrl)));
  router.get('/:id', asyncHandler(ctrl.getById.bind(ctrl)));
  router.post('/', asyncHandler(ctrl.create.bind(ctrl)));
  router.put('/:id', asyncHandler(ctrl.update.bind(ctrl)));
  router.delete('/:id', asyncHandler(ctrl.delete.bind(ctrl)));

  return router;
}
