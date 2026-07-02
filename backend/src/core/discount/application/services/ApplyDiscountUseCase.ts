import { DiscountEngine, DiscountContext, DiscountResult } from '../../domain/DiscountEngine';
import { IDiscountConfigurationRepository } from '../../infrastructure/persistence/IDiscountConfigurationRepository';

export interface DiscountInput {
  tenantId: string;
  items: Array<{
    productId: string;
    categoryId: string;
    quantity: number;
    unitPrice: number;
  }>;
  promoCode?: string;
  customerGroupId?: string;
}

export class ApplyDiscountUseCase {
  constructor(
    private readonly repo: IDiscountConfigurationRepository,
    private readonly engine: DiscountEngine,
  ) {}

  async execute(input: DiscountInput): Promise<DiscountResult> {
    const config = await this.repo.findByTenantId(input.tenantId);
    if (!config || !config.enabled) {
      return { totalDiscount: 0, appliedRules: [], freeItems: [], finalSubtotal: 0, breakdown: [] };
    }

    const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const items = input.items.map((i) => ({
      ...i,
      lineTotal: i.unitPrice * i.quantity,
    }));

    const context: DiscountContext = {
      subtotal,
      items,
      promoCode: input.promoCode,
      customerGroupId: input.customerGroupId,
    };

    return this.engine.applyDiscounts(items, subtotal, config.rules, context);
  }
}
