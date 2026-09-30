import { asClass, Lifetime } from 'awilix';
import { MongoTaxConfigurationRepository } from '../../core/tax/infrastructure/persistence/MongoTaxConfigurationRepository';
import { TaxServiceAdapter } from '../../core/tax/application/services/TaxServiceAdapter';
import type { WiringContext } from './types';

/**
 * Registers the tax domain: the tax-configuration repository plus
 * `TaxServiceAdapter`, the single adapter the payment and order paths call.
 *
 * The adapter optionally consults pricing profiles, which is why this wiring
 * declares the dependency on the pricing repository as optional rather than
 * making tax depend on the catalog.
 */
export function registerTaxWiring({ container, models }: WiringContext): void {
  container.register({
    taxConfigurationRepository: asClass(MongoTaxConfigurationRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.TaxConfigurationModel,
      }),
    }),
    taxService: asClass(TaxServiceAdapter, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        repo: container.resolve('taxConfigurationRepository'),
        pricingProfileRepo: container.resolve('pricingProfileRepository'),
      }),
    }),
  });
}
