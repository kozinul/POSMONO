import { asClass, Lifetime } from 'awilix';
import { MongoTenantRepository } from '../../core/tenant/infrastructure/persistence/MongoTenantRepository';
import { TenantService } from '../../core/tenant/application/services/TenantService';
import { OnboardingService } from '../../core/platform/application/services/OnboardingService';
import { TenantController } from '../../core/tenant/interfaces/http/controllers/TenantController';
import type { WiringContext } from './types';

/**
 * Registers the tenant domain: the tenant repository, `TenantService` (plan
 * status, deactivation, hub linkage) and `OnboardingService`, which seeds roles,
 * templates and payment methods for a brand-new tenant.
 *
 * The tenant is the legal data boundary: every repository in every other
 * wiring filters on `tenantId`, which is why this domain is registered even
 * though its controllers are small.
 */
export function registerTenantWiring({ container, models }: WiringContext): void {
  container.register({
    tenantRepository: asClass(MongoTenantRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.TenantModel,
      }),
    }),
    tenantService: asClass(TenantService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        tenantRepository: container.resolve('tenantRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    onboardingService: asClass(OnboardingService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          tenantRepository: container.resolve('tenantRepository'),
          roleRepository: container.resolve('roleRepository'),
          userRepository: container.resolve('userRepository'),
          paymentMethodRepository: container.resolve('paymentMethodRepository'),
          warehouseService: container.resolve('warehouseService'),
          templateService: container.resolve('templateService'),
        },
      }),
    }),
    tenantController: asClass(TenantController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        tenantService: container.resolve('tenantService'),
        hubRepository: container.resolve('hubRepository'),
      }),
    }),
  });
}
