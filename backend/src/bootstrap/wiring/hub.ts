import { asClass, Lifetime } from 'awilix';
import { MongoHubRepository } from '../../core/hub/infrastructure/persistence/MongoHubRepository';
import { HubService } from '../../core/hub/application/services/HubService';
import { HubController } from '../../core/hub/interfaces/http/controllers/HubController';
import { MongoHubMembershipRepository } from '../../core/hub/infrastructure/persistence/MongoHubMembershipRepository';
import { HubMembershipService } from '../../core/hub/application/services/HubMembershipService';
import { MongoHubMemberTenantAccessRepository } from '../../core/hub/infrastructure/persistence/MongoHubMemberTenantAccessRepository';
import { HubMemberAccessService } from '../../core/hub/application/services/HubMemberAccessService';
import { HubMembershipController } from '../../core/hub/interfaces/http/controllers/HubMembershipController';
import { MongoHubInvitationRepository } from '../../core/hub/infrastructure/persistence/MongoHubInvitationRepository';
import { HubInvitationService } from '../../core/hub/application/services/HubInvitationService';
import { HubInvitationController } from '../../core/hub/interfaces/http/controllers/HubInvitationController';
import { MyHubController } from '../../core/hub/interfaces/http/controllers/MyHubController';
import type { WiringContext } from './types';

/**
 * Registers the hub domain (hub grouping sits *above* a tenant and holds no
 * business data of its own — decision D2 in docs/HUB_V2_DECISIONS.md).
 *
 * The access triple is deliberate and must be read together:
 * `hubMembershipRepository` (who is in the hub), `hubMembershipService`
 * (membership lifecycle) and `hubMemberAccessService` +
 * `hubMemberTenantAccessRepository` (the Fase 17 per-tenant/per-outlet grant).
 * A member with zero grant rows falls back to the legacy wide access — which is
 * exactly why the two are wired side by side and never merged.
 */
export function registerHubWiring({ container, models }: WiringContext): void {
  container.register({
    hubRepository: asClass(MongoHubRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.HubModel,
      }),
    }),
    hubService: asClass(HubService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        hubRepository: container.resolve('hubRepository'),
        tenantRepository: container.resolve('tenantRepository'),
      }),
    }),
    hubController: asClass(HubController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        hubService: container.resolve('hubService'),
        auditService: container.resolve('platformAuditService'),
      }),
    }),
    hubMembershipRepository: asClass(MongoHubMembershipRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.HubMembershipModel,
      }),
    }),
    hubMembershipService: asClass(HubMembershipService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          hubMembershipRepository: container.resolve('hubMembershipRepository'),
          hubRepository: container.resolve('hubRepository'),
          tenantRepository: container.resolve('tenantRepository'),
          userRepository: container.resolve('userRepository'),
          accessService: container.resolve('hubMemberAccessService'),
        },
      }),
    }),
    hubMemberTenantAccessRepository: asClass(MongoHubMemberTenantAccessRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.HubMemberTenantAccessModel,
      }),
    }),
    hubMemberAccessService: asClass(HubMemberAccessService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          accessRepository: container.resolve('hubMemberTenantAccessRepository'),
          hubMembershipRepository: container.resolve('hubMembershipRepository'),
          hubRepository: container.resolve('hubRepository'),
          tenantRepository: container.resolve('tenantRepository'),
          outletRepository: container.resolve('outletRepository'),
        },
      }),
    }),
    hubMembershipController: asClass(HubMembershipController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        hubMembershipService: container.resolve('hubMembershipService'),
        auditService: container.resolve('platformAuditService'),
        hubMemberAccessService: container.resolve('hubMemberAccessService'),
      }),
    }),
    hubInvitationRepository: asClass(MongoHubInvitationRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.HubInvitationModel,
      }),
    }),
    // Accepting an invitation reuses `hubMembershipService.addMembership` so the
    // membership it creates goes through the same validation, archived-hub guard
    // and ADR D3 grant baseline as one added by hand.
    hubInvitationService: asClass(HubInvitationService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          invitationRepository: container.resolve('hubInvitationRepository'),
          hubRepository: container.resolve('hubRepository'),
          membershipService: container.resolve('hubMembershipService'),
          userRepository: container.resolve('userRepository'),
        },
      }),
    }),
    hubInvitationController: asClass(HubInvitationController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        hubInvitationService: container.resolve('hubInvitationService'),
        auditService: container.resolve('platformAuditService'),
      }),
    }),
    // Hub V2 Fase 21 — member-facing reads. Cross-domain sources are resolved
    // lazily here (not at registration time) so the hub context stays loadable on
    // its own; the read model declares only the methods it calls, so passing the
    // real services satisfies it without a new port interface.
    myHubController: asClass(MyHubController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          accessService: container.resolve('hubMemberAccessService'),
          hubService: container.resolve('hubService'),
          membersSource: container.resolve('hubMembershipService'),
          outletsSource: container.resolve('outletService'),
          activitySource: container.resolve('shiftService'),
          salesSource: container.resolve('reportService'),
          subscriptionSource: container.resolve('subscriptionService'),
        },
      }),
    }),
  });
}
