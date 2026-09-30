import { asClass, Lifetime } from 'awilix';
import { MongoPlanRepository } from '../../core/billing/infrastructure/persistence/MongoPlanRepository';
import { MongoSubscriptionRepository } from '../../core/billing/infrastructure/persistence/MongoSubscriptionRepository';
import { PlanService } from '../../core/billing/application/services/PlanService';
import { SubscriptionService } from '../../core/billing/application/services/SubscriptionService';
import { MongoSubscriptionHistoryRepository } from '../../core/billing/infrastructure/persistence/MongoSubscriptionHistoryRepository';
import { EntitlementService } from '../../core/billing/application/services/EntitlementService';
import { PlanController } from '../../core/billing/interfaces/http/controllers/PlanController';
import { SubscriptionController } from '../../core/billing/interfaces/http/controllers/SubscriptionController';
import type { WiringContext } from './types';

/**
 * Registers the billing domain: plans, subscriptions, the subscription-history
 * ledger and `EntitlementService` (module/limit resolution with the add-on OR
 * rule and the hardcoded Trial fallback).
 *
 * Self-service plan management is deliberately NOT wired for tenants: only the
 * platform side assigns a plan (Fase 14), and `cancelSubscription` deactivates
 * the tenant rather than silently downgrading it.
 */
export function registerBillingWiring({ container, models }: WiringContext): void {
  container.register({
    planRepository: asClass(MongoPlanRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: models.PlanModel }),
    }),
    subscriptionRepository: asClass(MongoSubscriptionRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: models.SubscriptionModel }),
    }),
    planService: asClass(PlanService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        planRepository: container.resolve('planRepository'),
      }),
    }),
    subscriptionService: asClass(SubscriptionService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        subscriptionRepository: container.resolve('subscriptionRepository'),
        planRepository: container.resolve('planRepository'),
        tenantRepository: container.resolve('tenantRepository'),
        historyRepository: container.resolve('subscriptionHistoryRepository'),
      }),
    }),
    subscriptionHistoryRepository: asClass(MongoSubscriptionHistoryRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: models.SubscriptionHistoryModel }),
    }),
    entitlementService: asClass(EntitlementService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        subscriptionRepository: container.resolve('subscriptionRepository'),
        planRepository: container.resolve('planRepository'),
        tenantRepository: container.resolve('tenantRepository'),
      }),
    }),
    planController: asClass(PlanController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        planService: container.resolve('planService'),
      }),
    }),
    subscriptionController: asClass(SubscriptionController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        subscriptionService: container.resolve('subscriptionService'),
        entitlementService: container.resolve('entitlementService'),
        auditService: container.resolve('platformAuditService'),
      }),
    }),
  });
}
