import { DiscountEngine, DiscountResult } from '../../domain/DiscountEngine';
import { DiscountRule, IDiscountRule } from '../../domain/DiscountRule';
import { IDiscountConfigurationRepository } from '../../infrastructure/persistence/IDiscountConfigurationRepository';
import { IPromoCodeRepository } from '../../infrastructure/persistence/IPromoCodeRepository';

export class DiscountServiceAdapter {
  private readonly engine: DiscountEngine;

  constructor(
    private readonly configRepo: IDiscountConfigurationRepository,
    private readonly promoCodeRepo?: IPromoCodeRepository,
  ) {
    this.engine = new DiscountEngine();
  }

  async apply(input: {
    tenantId: string;
    items: Array<{ productId: string; categoryId: string; quantity: number; unitPrice: number }>;
    promoCode?: string;
    customerGroupId?: string;
  }): Promise<DiscountResult> {
    const config = await this.configRepo.findByTenantId(input.tenantId);
    if (!config || !config.enabled) {
      const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      return {
        totalDiscount: 0,
        appliedRules: [],
        freeItems: [],
        generatedLineItems: [],
        freeItemValue: 0,
        finalSubtotal: subtotal,
        breakdown: [],
        itemDiscounts: [],
      };
    }

    const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const items = input.items.map((i) => ({ ...i, lineTotal: i.unitPrice * i.quantity }));

    return this.engine.applyDiscounts(items, subtotal, config.rules, {
      promoCode: input.promoCode,
      customerGroupId: input.customerGroupId,
    });
  }

  async validatePromoCode(tenantId: string, code: string): Promise<{
    valid: boolean;
    ruleName?: string;
    error?: string;
  }> {
    const normalizedCode = code.trim().toUpperCase();

    const config = await this.configRepo.findByTenantId(tenantId);
    const findSyncedPromotionRule = (): IDiscountRule | undefined => {
      if (!config?.enabled) return undefined;
      return config.rules.find((rule) => {
        if (!rule.active) return false;
        if (rule.promoCodeId?.toUpperCase() !== normalizedCode) return false;
        return !DiscountRule.create(rule).isExpired();
      });
    };

    if (!this.promoCodeRepo) {
      const rule = findSyncedPromotionRule();
      return rule ? { valid: true, ruleName: rule.name } : { valid: false, error: 'Kode promo tidak ditemukan' };
    }

    const promoCodeData = await this.promoCodeRepo.findByCode(tenantId, normalizedCode);
    if (!promoCodeData) {
      const rule = findSyncedPromotionRule();
      return rule ? { valid: true, ruleName: rule.name } : { valid: false, error: 'Kode promo tidak ditemukan' };
    }

    const { PromoCode } = require('../../domain/PromoCode');
    const promoCode = PromoCode.create(promoCodeData);

    if (!promoCode.isValid()) {
      return { valid: false, error: 'Kode promo sudah tidak berlaku' };
    }

    if (!config?.enabled) {
      return { valid: false, error: 'Diskon tidak aktif' };
    }

    const rule = config.rules.find((r) => r.id === promoCode.getRuleId());
    if (!rule || !rule.active) {
      return { valid: false, error: 'Aturan promo tidak ditemukan' };
    }

    return { valid: true, ruleName: rule.name };
  }
}
