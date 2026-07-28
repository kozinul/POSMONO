import { Router } from 'express';
import { PricingController } from './pricing.controller';
import { PricingService } from '../application/services/PricingService';
import { DiscountServiceAdapter } from '../../discount/application/services/DiscountServiceAdapter';
import { IDiscountConfigurationRepository } from '../../discount/infrastructure/persistence/IDiscountConfigurationRepository';
import { IPromoCodeRepository } from '../../discount/infrastructure/persistence/IPromoCodeRepository';
import { ITaxConfigurationRepository } from '../../tax/infrastructure/persistence/ITaxConfigurationRepository';

type AsyncHandler = (fn: (req: any, res: any, next?: any) => Promise<any>) => (req: any, res: any, next?: any) => void;

export function createPricingRouter(
  discountRepo: IDiscountConfigurationRepository,
  taxRepo: ITaxConfigurationRepository,
  promoCodeRepo?: IPromoCodeRepository,
): Router {
  const router = Router();

  const discountService = new DiscountServiceAdapter(discountRepo, promoCodeRepo);
  const pricingService = new PricingService(discountService, taxRepo);
  const controller = new PricingController(pricingService);

  const asyncHandler: AsyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

  router.post('/:tenantId?/calculate', asyncHandler(controller.calculate));

  return router;
}
