import { DiscountEngine, DiscountResult } from '../../domain/DiscountEngine';
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
        finalSubtotal: subtotal,
        breakdown: [],
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
    if (!this.promoCodeRepo) {
      return { valid: false, error: 'Promo code repository not available' };
    }

    const promoCodeData = await this.promoCodeRepo.findByCode(tenantId, code);
    if (!promoCodeData) {
      return { valid: false, error: 'Kode promo tidak ditemukan' };
    }

    const { PromoCode } = require('../../domain/PromoCode');
    const promoCode = PromoCode.create(promoCodeData);

    if (!promoCode.isValid()) {
      return { valid: false, error: 'Kode promo sudah tidak berlaku' };
    }

    const config = await this.configRepo.findByTenantId(tenantId);
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
