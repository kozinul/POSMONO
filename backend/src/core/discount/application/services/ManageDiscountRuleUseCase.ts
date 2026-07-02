import { DiscountConfiguration, IDiscountConfiguration } from '../../domain/DiscountConfiguration';
import { DiscountRule, IDiscountRule } from '../../domain/DiscountRule';
import { DiscountScope } from '../../domain/DiscountScope';
import { DiscountPolicy } from '../../domain/DiscountPolicy';
import { IDiscountConfigurationRepository } from '../../infrastructure/persistence/IDiscountConfigurationRepository';

export class ManageDiscountRuleUseCase {
  constructor(private readonly repo: IDiscountConfigurationRepository) {}

  async getConfig(tenantId: string): Promise<IDiscountConfiguration | null> {
    return this.repo.findByTenantId(tenantId);
  }

  async toggleEnabled(tenantId: string, enabled: boolean): Promise<IDiscountConfiguration> {
    let configData = await this.repo.findByTenantId(tenantId);
    let config: DiscountConfiguration;

    if (!configData) {
      config = DiscountConfiguration.create({ tenantId, enabled, rules: [] });
    } else {
      config = DiscountConfiguration.hydrate(configData);
      config.setEnabled(enabled);
    }

    const serialized = config.serialize();
    await this.repo.save(serialized);
    return serialized;
  }

  async addRule(tenantId: string, ruleData: IDiscountRule): Promise<IDiscountConfiguration> {
    let configData = await this.repo.findByTenantId(tenantId);
    let config: DiscountConfiguration;

    const rule = DiscountRule.create(ruleData);

    if (!configData) {
      config = DiscountConfiguration.create({ tenantId, enabled: true, rules: [] });
    } else {
      config = DiscountConfiguration.hydrate(configData);
    }

    config.addRule(rule);

    const serialized = config.serialize();
    await this.repo.save(serialized);
    return serialized;
  }

  async updateRule(tenantId: string, rule: IDiscountRule): Promise<IDiscountConfiguration> {
    const configData = await this.repo.findByTenantId(tenantId);
    if (!configData) throw new Error('Discount configuration not found');

    const config = DiscountConfiguration.hydrate(configData);
    config.updateRule(DiscountRule.create(rule));

    const serialized = config.serialize();
    await this.repo.save(serialized);
    return serialized;
  }

  async removeRule(tenantId: string, ruleId: string): Promise<IDiscountConfiguration> {
    const configData = await this.repo.findByTenantId(tenantId);
    if (!configData) throw new Error('Discount configuration not found');

    const config = DiscountConfiguration.hydrate(configData);
    config.removeRule(ruleId);

    const serialized = config.serialize();
    await this.repo.save(serialized);
    return serialized;
  }

  async createPromoCode(
    _tenantId: string,
    _data: { code: string; ruleId: string; maxUsageCount?: number; expiresAt?: string },
  ): Promise<void> {
    // Delegated to PromoCode management controller
  }
}
