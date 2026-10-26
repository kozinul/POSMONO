import { MongoSubscriptionRepository } from '../../infrastructure/persistence/MongoSubscriptionRepository';
import { MongoPlanRepository } from '../../infrastructure/persistence/MongoPlanRepository';
import { MongoTenantRepository } from '../../../tenant/infrastructure/persistence/MongoTenantRepository';

export interface PlanAddOnView {
  id: string;
  name?: string;
  type: 'module' | 'limit';
  value: string | number;
}

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
    addOns: PlanAddOnView[];
    enabledAddOns: string[];
  }> {
    const sub = await this.subscriptionRepository.findByTenantId(tenantId);
    const subscription = sub ? sub.serialize() : null;
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

    // Add-on modules extend the plan, but only while the subscription itself is
    // live. The platform may keep add-on ids on a cancelled subscription; they
    // must not grant access after expiry.
    const addOns: PlanAddOnView[] = plan?.addOns ?? [];
    const enabledAddOns: string[] = sub && sub.isActive() ? subscription?.enabledAddOns ?? [] : [];
    const addOnModules = addOns
      .filter((addOn) => addOn.type === 'module' && enabledAddOns.includes(addOn.id))
      .map((addOn) => String(addOn.value))
      .filter(Boolean);

    const baseModules: string[] = plan?.modules ?? ['products', 'orders', 'payments', 'shifts'];

    return {
      plan: plan || { name: 'Trial', basePrice: 0 },
      subscription,
      modules: [...new Set([...baseModules, ...addOnModules])],
      limits: plan ? plan.limits : defaultLimits,
      addOns,
      enabledAddOns,
    };
  }

  async hasModule(tenantId: string, moduleName: string): Promise<boolean> {
    const entitlement = await this.getTenantEntitlement(tenantId);
    return entitlement.modules.includes(moduleName);
  }
}
