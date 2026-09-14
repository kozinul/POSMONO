import { MongoSubscriptionRepository } from '../../infrastructure/persistence/MongoSubscriptionRepository';
import { MongoPlanRepository } from '../../infrastructure/persistence/MongoPlanRepository';
import { MongoTenantRepository } from '../../../tenant/infrastructure/persistence/MongoTenantRepository';

export class EntitlementService {
  constructor(
    private readonly subscriptionRepository: MongoSubscriptionRepository,
    private readonly planRepository: MongoPlanRepository,
    private readonly tenantRepository: MongoTenantRepository,
  ) {}

  async getTenantEntitlement(tenantId: string): Promise<{
    plan: any;
    subscription: any;
    modules: string[];
    limits: any;
  }> {
    const sub = await this.subscriptionRepository.findByTenantId(tenantId);
    let plan: any = null;

    if (sub) {
      const planEntity = await this.planRepository.findById(sub.serialize().planId);
      if (planEntity) {
        plan = planEntity.serialize();
      }
    }

    if (!plan) {
      const defaultPlan = await this.planRepository.findDefault();
      if (defaultPlan) {
        plan = defaultPlan.serialize();
      }
    }

    const defaultLimits = {
      maxUsers: 5,
      maxProducts: 100,
      maxCategories: 20,
      maxOutlets: 1,
      maxOrdersPerMonth: 500,
      maxInventoryItems: 500,
      maxWarehouses: 1,
    };

    return {
      plan: plan || { name: 'Trial', basePrice: 0 },
      subscription: sub ? sub.serialize() : null,
      modules: plan ? plan.modules : ['products', 'orders', 'payments', 'shifts'],
      limits: plan ? plan.limits : defaultLimits,
    };
  }

  async hasModule(tenantId: string, moduleName: string): Promise<boolean> {
    const entitlement = await this.getTenantEntitlement(tenantId);
    return entitlement.modules.includes(moduleName);
  }
}
