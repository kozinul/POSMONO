import { Router } from 'express';
import { DiscountController } from './discount.controller';
import { ManageDiscountRuleUseCase } from '../application/services/ManageDiscountRuleUseCase';
import { DiscountServiceAdapter } from '../application/services/DiscountServiceAdapter';
import { IDiscountConfigurationRepository } from '../infrastructure/persistence/IDiscountConfigurationRepository';
import { IPromoCodeRepository } from '../infrastructure/persistence/IPromoCodeRepository';

type AsyncHandler = (fn: (req: any, res: any, next?: any) => Promise<any>) => (req: any, res: any, next?: any) => void;

export function createDiscountRouter(
  repo: IDiscountConfigurationRepository,
  promoCodeRepo?: IPromoCodeRepository,
): Router {
  const router = Router();

  const manageRules = new ManageDiscountRuleUseCase(repo);
  const discountService = new DiscountServiceAdapter(repo, promoCodeRepo);
  const controller = new DiscountController(manageRules, discountService);

  const asyncHandler: AsyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

  router.get('/:tenantId?', asyncHandler(controller.getConfig));
  router.put('/:tenantId?/toggle', asyncHandler(controller.toggleEnabled));
  router.post('/:tenantId?/rules', asyncHandler(controller.addRule));
  router.put('/:tenantId?/rules/:ruleId', asyncHandler(controller.updateRule));
  router.delete('/:tenantId?/rules/:ruleId', asyncHandler(controller.removeRule));
  router.post('/:tenantId?/calculate', asyncHandler(controller.calculate));
  router.post('/:tenantId?/validate-promo', asyncHandler(controller.validatePromoCode));

  return router;
}
