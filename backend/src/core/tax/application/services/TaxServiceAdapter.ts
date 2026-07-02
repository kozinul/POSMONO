import { TaxEngine, TaxCalculationInput, TaxCalculationResult } from '../../domain/TaxEngine';
import { ITaxConfigurationRepository } from '../../infrastructure/persistence/ITaxConfigurationRepository';
import { IPricingProfileRepository } from '../../../pricing/infrastructure/persistence/IPricingProfileRepository';

export class TaxServiceAdapter {
  constructor(
    private readonly repo: ITaxConfigurationRepository,
    private readonly pricingProfileRepo?: IPricingProfileRepository,
  ) {}

  async calculate(input: {
    tenantId: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      categoryId: string;
      pricingProfileId?: string;
    }>;
    discount: number;
    discountType: 'percentage' | 'nominal';
    customerTags?: string[];
  }): Promise<TaxCalculationResult & { taxes: TaxCalculationResult['taxBreakdown'] }> {
    const config = await this.repo.findByTenantIdOrFail(input.tenantId);

    const engineInput: TaxCalculationInput = {
      tenantId: input.tenantId,
      items: input.items.map((item) => ({
        id: item.productId,
        productId: item.productId,
        productName: item.productName,
        categoryId: item.categoryId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      discount: input.discount,
      discountType: input.discountType,
      customerTags: input.customerTags,
    };

    // Resolve pricing profiles → allowed ruleIds
    let allowedRuleIds: string[] | undefined;
    if (this.pricingProfileRepo) {
      const profileIds = [...new Set(input.items.map((i) => i.pricingProfileId).filter(Boolean))] as string[];
      if (profileIds.length > 0) {
        const profiles = await this.pricingProfileRepo.findByIds(input.tenantId, profileIds);
        allowedRuleIds = [...new Set(profiles.flatMap((p) => p.getTaxRuleIds()))];
      }
    }

    const result = TaxEngine.calculate(engineInput, config, allowedRuleIds);

    return {
      ...result,
      taxes: result.taxBreakdown,
    };
  }
}
