import { Subscription } from '../../domain/Subscription';
import { SubscriptionHistory, SubscriptionHistoryAction } from '../../domain/SubscriptionHistory';
import { MongoSubscriptionRepository } from '../../infrastructure/persistence/MongoSubscriptionRepository';
import { MongoSubscriptionHistoryRepository } from '../../infrastructure/persistence/MongoSubscriptionHistoryRepository';
import { MongoPlanRepository } from '../../infrastructure/persistence/MongoPlanRepository';
import { MongoTenantRepository } from '../../../tenant/infrastructure/persistence/MongoTenantRepository';
import { NotFoundError } from '../../../../@shared/infrastructure/error/AppError';

export interface SubscriptionActionContext {
  actorEmail?: string | null;
  reason?: string | null;
}

export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: MongoSubscriptionRepository,
    private readonly planRepository: MongoPlanRepository,
    private readonly tenantRepository: MongoTenantRepository,
    private readonly historyRepository?: MongoSubscriptionHistoryRepository,
  ) {}

  async getTenantSubscription(tenantId: string): Promise<{ subscription: any; plan: any }> {
    const sub = await this.subscriptionRepository.findByTenantId(tenantId);
    if (!sub) {
      return { subscription: null, plan: null };
    }
    const plan = await this.planRepository.findById(sub.serialize().planId);
    return {
      subscription: sub.serialize(),
      plan: plan ? plan.serialize() : null,
    };
  }

  /**
   * Hub V2 Fase 19 — subscription rollup for many tenants in two queries.
   *
   * `getTenantSubscription` per tenant would be 2N queries plus an N-sized array
   * in the caller; tenants without a subscription are omitted entirely (they
   * have nothing to roll up), matching that method's `null, null` contract.
   */
  async getTenantSubscriptions(tenantIds: string[]): Promise<
    Array<{
      tenantId: string;
      planId: string;
      planName: string | null;
      status: string;
      billingCycle: string;
      currentPeriodEnd: Date;
      daysRemaining: number;
    }>
  > {
    if (tenantIds.length === 0) return [];

    const subs = await this.subscriptionRepository.findByTenantIds(tenantIds);
    if (subs.length === 0) return [];

    const serialized = subs.map((s) => s.serialize());
    const plans = await this.planRepository.findByIds([...new Set(serialized.map((s) => s.planId))]);
    const planNameById = new Map(plans.map((p) => [p.serialize().id, p.serialize().name]));

    const now = Date.now();
    return serialized.map((s) => {
      const daysRemaining = Math.max(
        Math.ceil((s.currentPeriodEnd.getTime() - now) / (24 * 60 * 60 * 1000)),
        0,
      );
      return {
        tenantId: s.tenantId,
        planId: s.planId,
        planName: planNameById.get(s.planId) ?? null,
        status: s.status,
        billingCycle: s.billingCycle,
        currentPeriodEnd: s.currentPeriodEnd,
        daysRemaining,
      };
    });
  }

  async assignPlan(
    tenantId: string,
    planId: string,
    billingCycle?: 'monthly' | 'annual' | 'custom',
    context?: SubscriptionActionContext,
  ): Promise<Subscription> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant tidak ditemukan.');
    }

    const plan = await this.planRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError('Plan tidak ditemukan.');
    }

    const planProps = plan.serialize();
    const cycle = billingCycle || planProps.billingCycle;

    const now = new Date();
    const periodDays = cycle === 'annual' ? 365 : 30;
    const currentPeriodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    const existing = await this.subscriptionRepository.findByTenantId(tenantId);
    let sub: Subscription;
    if (existing) {
      const before = existing.serialize();
      sub = existing;
      sub.changePlan(planId, cycle, currentPeriodEnd);
      await this.subscriptionRepository.save(sub);
      await this.recordHistory('changed', tenantId, sub, {
        planBefore: before.planId,
        planNameBefore: before.planId,
        statusBefore: before.status,
        periodStartBefore: before.currentPeriodStart,
        periodEndBefore: before.currentPeriodEnd,
        planAfter: planId,
        planNameAfter: planProps.name,
        statusAfter: sub.serialize().status,
        periodStartAfter: sub.serialize().currentPeriodStart,
        periodEndAfter: sub.serialize().currentPeriodEnd,
        context,
      });
    } else {
      sub = Subscription.create({
        tenantId,
        planId,
        status: 'active',
        billingCycle: cycle,
        currentPeriodStart: now,
        currentPeriodEnd,
      });
      await this.subscriptionRepository.save(sub);
      await this.recordHistory('assigned', tenantId, sub, {
        planAfter: planId,
        planNameAfter: planProps.name,
        statusAfter: sub.serialize().status,
        periodStartAfter: sub.serialize().currentPeriodStart,
        periodEndAfter: sub.serialize().currentPeriodEnd,
        context,
      });
    }

    tenant.assignPlan(planId, planProps.name, planProps.modules, currentPeriodEnd);
    await this.tenantRepository.save(tenant);

    return sub;
  }

  async cancelSubscription(tenantId: string, reason?: string, context?: SubscriptionActionContext): Promise<Subscription> {
    const sub = await this.subscriptionRepository.findByTenantId(tenantId);
    if (!sub) {
      throw new NotFoundError('Subscription tidak ditemukan.');
    }

    const before = sub.serialize();
    sub.cancel(reason);
    await this.subscriptionRepository.save(sub);

    await this.recordHistory('cancelled', tenantId, sub, {
      statusBefore: before.status,
      statusAfter: sub.serialize().status,
      periodStartBefore: before.currentPeriodStart,
      periodEndBefore: before.currentPeriodEnd,
      periodStartAfter: sub.serialize().currentPeriodStart,
      periodEndAfter: sub.serialize().currentPeriodEnd,
      context: context ? { ...context, reason: context.reason ?? reason ?? null } : { reason },
    });

    const tenant = await this.tenantRepository.findById(tenantId);
    if (tenant) {
      tenant.deactivate();
      await this.tenantRepository.save(tenant);
    }

    return sub;
  }

  async extendSubscription(
    tenantId: string,
    days: number,
    context?: SubscriptionActionContext,
  ): Promise<Subscription | null> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant tidak ditemukan.');
    }

    const tenantBefore = tenant.serialize();
    tenant.extendSubscription(days);
    await this.tenantRepository.save(tenant);
    const tenantAfter = tenant.serialize();

    const sub = await this.subscriptionRepository.findByTenantId(tenantId);
    if (sub) {
      const before = sub.serialize();
      sub.extend(days);
      await this.subscriptionRepository.save(sub);
      await this.recordHistory('extended', tenantId, sub, {
        periodStartBefore: before.currentPeriodStart,
        periodEndBefore: before.currentPeriodEnd,
        periodStartAfter: sub.serialize().currentPeriodStart,
        periodEndAfter: sub.serialize().currentPeriodEnd,
        context,
      });
      return sub;
    }

    await this.recordHistory('extended', tenantId, null, {
      planAfter: tenantAfter.planId ?? tenantAfter.plan,
      periodStartBefore: tenantBefore.subscriptionExpiresAt,
      periodEndBefore: tenantBefore.subscriptionExpiresAt,
      periodStartAfter: tenantAfter.subscriptionExpiresAt,
      periodEndAfter: tenantAfter.subscriptionExpiresAt,
      context,
    });
    return null;
  }

  async getTenantSubscriptionHistory(tenantId: string): Promise<any[]> {
    if (!this.historyRepository) return [];
    const entries = await this.historyRepository.findByTenantId(tenantId, 100);
    return entries.map((e) => e.serialize());
  }

  /**
   * Auto-suspend — the only subscription mutation driven by the clock. Tenants
   * whose active period ran out but are still usable (`active`/`trial`) are
   * moved to `suspended`, the subscription document is expired (when present)
   * and an `expired` ledger row is written. Admin-chosen statuses
   * (`suspended/frozen/cancelled/deactivated`) are never overwritten.
   *
   * Ran at boot and on an interval (see `bootstrap/jobs/subscriptionSweep`).
   * The login and `getCurrent` gates also mark lazily, so the UI never shows a
   * stale "active" between the deadline and the next sweep.
   */
  async sweepExpired(now: Date = new Date()): Promise<{ total: number; suspended: number }> {
    const tenants = await this.tenantRepository.findActiveExpired(now);
    for (const tenant of tenants) {
      const before = tenant.serialize();
      tenant.suspend('Masa aktif berakhir — auto-suspend');
      await this.tenantRepository.save(tenant);

      const sub = await this.subscriptionRepository.findByTenantId(before.id);
      if (sub) {
        const subBefore = sub.serialize();
        sub.expire();
        await this.subscriptionRepository.save(sub);
        await this.recordHistory('expired', before.id, sub, {
          statusBefore: subBefore.status,
          statusAfter: sub.serialize().status,
          periodStartBefore: subBefore.currentPeriodStart,
          periodEndBefore: subBefore.currentPeriodEnd,
          periodStartAfter: sub.serialize().currentPeriodStart,
          periodEndAfter: sub.serialize().currentPeriodEnd,
          context: { reason: 'Masa aktif berakhir — auto-suspend' },
        });
      } else {
        await this.recordHistory('expired', before.id, null, {
          planAfter: before.planId ?? before.plan,
          periodStartBefore: before.subscriptionExpiresAt,
          periodEndBefore: before.subscriptionExpiresAt,
          context: { reason: 'Masa aktif berakhir — auto-suspend' },
        });
      }
    }
    return { total: tenants.length, suspended: tenants.length };
  }

  private async recordHistory(
    action: SubscriptionHistoryAction,
    tenantId: string,
    sub: Subscription | null,
    fields: {
      planBefore?: string | null;
      planNameBefore?: string | null;
      planAfter?: string | null;
      planNameAfter?: string | null;
      statusBefore?: string | null;
      statusAfter?: string | null;
      periodStartBefore?: Date | null;
      periodEndBefore?: Date | null;
      periodStartAfter?: Date | null;
      periodEndAfter?: Date | null;
      context?: SubscriptionActionContext;
    },
  ): Promise<void> {
    if (!this.historyRepository) return;
    try {
      const history = SubscriptionHistory.create({
        tenantId,
        subscriptionId: sub?.serialize().id ?? null,
        action,
        planId: fields.planAfter ?? sub?.serialize().planId ?? null,
        planName: fields.planNameAfter ?? null,
        statusBefore: fields.statusBefore ?? null,
        statusAfter: fields.statusAfter ?? sub?.serialize().status ?? null,
        periodStartBefore: fields.periodStartBefore ?? null,
        periodEndBefore: fields.periodEndBefore ?? null,
        periodStartAfter: fields.periodStartAfter ?? null,
        periodEndAfter: fields.periodEndAfter ?? null,
        actorEmail: fields.context?.actorEmail ?? null,
        reason: fields.context?.reason ?? null,
      });
      await this.historyRepository.save(history);
    } catch {
      // Ledger write must never break the primary billing operation.
    }
  }
}