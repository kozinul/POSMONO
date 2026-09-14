import { Subscription } from '../../domain/Subscription';
import { MongoSubscriptionRepository } from '../../infrastructure/persistence/MongoSubscriptionRepository';
import { MongoPlanRepository } from '../../infrastructure/persistence/MongoPlanRepository';
import { MongoTenantRepository } from '../../../tenant/infrastructure/persistence/MongoTenantRepository';
import { NotFoundError } from '../../../../@shared/infrastructure/error/AppError';

export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: MongoSubscriptionRepository,
    private readonly planRepository: MongoPlanRepository,
    private readonly tenantRepository: MongoTenantRepository,
  ) {}

  async getTenantSubscription(tenantId: string): Promise<{ subscription: any; plan: any }> {
    const sub = await this.subscriptionRepository.findByTenantId(tenantId);
    if (!sub) {
      throw new NotFoundError('Subscription tidak ditemukan untuk tenant ini.');
    }
    const plan = await this.planRepository.findById(sub.serialize().planId);
    return {
      subscription: sub.serialize(),
      plan: plan ? plan.serialize() : null,
    };
  }

  async assignPlan(tenantId: string, planId: string, billingCycle?: 'monthly' | 'annual' | 'custom'): Promise<Subscription> {
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

    let sub = await this.subscriptionRepository.findByTenantId(tenantId);
    if (sub) {
      sub.changePlan(planId, cycle, currentPeriodEnd);
    } else {
      sub = Subscription.create({
        tenantId,
        planId,
        status: 'active',
        billingCycle: cycle,
        currentPeriodStart: now,
        currentPeriodEnd,
      });
    }

    await this.subscriptionRepository.save(sub);

    tenant.assignPlan(planId, planProps.name, planProps.modules, currentPeriodEnd);
    await this.tenantRepository.save(tenant);

    return sub;
  }

  async cancelSubscription(tenantId: string): Promise<Subscription> {
    const sub = await this.subscriptionRepository.findByTenantId(tenantId);
    if (!sub) {
      throw new NotFoundError('Subscription tidak ditemukan.');
    }

    sub.cancel();
    await this.subscriptionRepository.save(sub);

    const tenant = await this.tenantRepository.findById(tenantId);
    if (tenant) {
      tenant.deactivate();
      await this.tenantRepository.save(tenant);
    }

    return sub;
  }
}
