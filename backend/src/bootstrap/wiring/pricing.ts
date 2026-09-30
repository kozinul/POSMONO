import { asClass, Lifetime } from 'awilix';
import { MongoPricingProfileRepository } from '../../core/pricing/infrastructure/persistence/MongoPricingProfileRepository';
import type { WiringContext } from './types';

/**
 * Registers the pricing domain: the pricing-profile repository.
 *
 * Kept as its own wiring even though it currently has exactly one consumer —
 * `TaxServiceAdapter` reading `pricingProfileIds` — because pricing profiles are
 * the documented home for price lists and the next consumer should not land in
 * the tax adapter.
 */
export function registerPricingWiring({ container, models }: WiringContext): void {
  container.register({
    pricingProfileRepository: asClass(MongoPricingProfileRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.PricingProfileModel,
      }),
    }),
  });
}
