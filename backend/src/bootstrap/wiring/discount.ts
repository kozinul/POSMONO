import { asClass, Lifetime } from 'awilix';
import { MongoDiscountConfigurationRepository } from '../../core/discount/infrastructure/persistence/MongoDiscountConfigurationRepository';
import { MongoPromoCodeRepository } from '../../core/discount/infrastructure/persistence/MongoPromoCodeRepository';
import { DiscountServiceAdapter } from '../../core/discount/application/services/DiscountServiceAdapter';
import { ManageDiscountRuleUseCase } from '../../core/discount/application/services/ManageDiscountRuleUseCase';
import type { WiringContext } from './types';

/**
 * Registers the discount domain: discount configuration, promo codes, the
 * `DiscountServiceAdapter` and the manage-discount-rule use case.
 *
 * `discountService` is what recomputes `freeItemValue` and the applied rule on
 * every create/update/payment path, so promotion, payment and ordering wirings
 * all resolve it lazily.
 */
export function registerDiscountWiring({ container }: WiringContext): void {
  container.register({
    discountConfigurationRepository: asClass(MongoDiscountConfigurationRepository, {
      lifetime: Lifetime.SINGLETON,
    }),
    promoCodeRepository: asClass(MongoPromoCodeRepository, {
      lifetime: Lifetime.SINGLETON,
    }),
    discountService: asClass(DiscountServiceAdapter, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        configRepo: container.resolve('discountConfigurationRepository'),
        promoCodeRepo: container.resolve('promoCodeRepository'),
      }),
    }),
    manageDiscountRuleUseCase: asClass(ManageDiscountRuleUseCase, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        repo: container.resolve('discountConfigurationRepository'),
      }),
    }),
  });
}
