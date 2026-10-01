import { asClass, Lifetime } from 'awilix';
import { ProvisionTenantService } from '../../core/platform/application/services/ProvisionTenantService';
import { PlatformCleanupService } from '../../core/platform/application/services/PlatformCleanupService';
import { PlatformController } from '../../core/platform/interfaces/http/controllers/PlatformController';
import { MongoPlatformAuditLogRepository } from '../../core/platform/audit/infrastructure/persistence/MongoPlatformAuditLogRepository';
import { PlatformAuditService } from '../../core/platform/audit/application/services/PlatformAuditService';
import { MongoProvisioningRunRepository } from '../../core/platform/provisioning/infrastructure/persistence/MongoProvisioningRunRepository';
import type { WiringContext } from './types';

/**
 * Registers the platform (Terminal Center) domain: tenant provisioning, the hard
 * delete cascade (`PlatformCleanupService`), the platform controller, the audit
 * ledger and the provisioning-run repository.
 *
 * The only wiring besides `models` that needs `systemConnection`: the
 * provisioning-run repository takes the connection, not a compiled model.
 *
 * These keys are reachable only through `platformAuthenticate` +
 * `platformAuthorize`; nothing here trusts the body or a plain tenant token.
 */
export function registerPlatformWiring({ container, models, systemConnection }: WiringContext): void {
  container.register({
    provisionTenantService: asClass(ProvisionTenantService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          tenantRepository: container.resolve('tenantRepository'),
          userRepository: container.resolve('userRepository'),
          roleRepository: container.resolve('roleRepository'),
          hubRepository: container.resolve('hubRepository'),
          outletService: container.resolve('outletService'),
          templateService: container.resolve('templateService'),
          provisioningRunRepository: container.resolve('provisioningRunRepository'),
        },
      }),
    }),
    platformCleanupService: asClass(PlatformCleanupService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ connection: systemConnection }),
    }),
    platformController: asClass(PlatformController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          hubService: container.resolve('hubService'),
          tenantService: container.resolve('tenantService'),
          outletService: container.resolve('outletService'),
          shiftService: container.resolve('shiftService'),
          paymentService: container.resolve('paymentService'),
          tenantRepository: container.resolve('tenantRepository'),
          hubRepository: container.resolve('hubRepository'),
          provisionTenantService: container.resolve('provisionTenantService'),
          auditService: container.resolve('platformAuditService'),
          subscriptionService: container.resolve('subscriptionService'),
          provisioningRunRepository: container.resolve('provisioningRunRepository'),
          userRepository: container.resolve('userRepository'),
          roleRepository: container.resolve('roleRepository'),
          warehouseRepository: container.resolve('warehouseRepository'),
          userService: container.resolve('userService'),
          cleanupService: container.resolve('platformCleanupService'),
          hubMembershipService: container.resolve('hubMembershipService'),
          reportService: container.resolve('reportService'),
        },
      }),
    }),
    platformAuditLogRepository: asClass(MongoPlatformAuditLogRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: models.PlatformAuditLogModel }),
    }),
    platformAuditService: asClass(PlatformAuditService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        repository: container.resolve('platformAuditLogRepository'),
      }),
    }),
    provisioningRunRepository: asClass(MongoProvisioningRunRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: models.ProvisioningRunModel }),
    }),
  });
}
