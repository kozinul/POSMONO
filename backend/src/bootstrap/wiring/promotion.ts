import { asClass, Lifetime } from 'awilix';
import { MongoPromotionRepository } from '../../core/promotion/infrastructure/persistence/MongoPromotionRepository';
import { PromotionService } from '../../core/promotion/application/services/PromotionService';
import { PromotionController } from '../../core/promotion/interfaces/http/controllers/PromotionController';
import type { WiringContext } from './types';

/**
 * Registers the promotion domain. `promotionService` additionally resolves
 * `discountConfigurationRepository` (tax/pricing context) and `eventBus`.
 * Domain-owned: repository, service, controller.
 */
export function registerPromotionWiring({ container, models }: WiringContext): void {
  container.register({
    promotionRepository: asClass(MongoPromotionRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.PromotionModel,
      }),
    }),
    promotionService: asClass(PromotionService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        promotionRepository: container.resolve('promotionRepository'),
        discountConfigRepo: container.resolve('discountConfigurationRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    promotionController: asClass(PromotionController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        promotionService: container.resolve('promotionService'),
      }),
    }),
  });
}
