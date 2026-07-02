import { IPromoCodeRepository } from '../../infrastructure/persistence/IPromoCodeRepository';
import { IDiscountConfigurationRepository } from '../../infrastructure/persistence/IDiscountConfigurationRepository';
import { PromoCode } from '../../domain/PromoCode';

export interface PromoCodeValidationResult {
  valid: boolean;
  promoCode?: PromoCode;
  ruleName?: string;
  discountDescription?: string;
  error?: string;
}

export class ValidatePromoCodeUseCase {
  constructor(
    private readonly promoCodeRepo: IPromoCodeRepository,
    private readonly discountConfigRepo: IDiscountConfigurationRepository,
  ) {}

  async execute(tenantId: string, code: string): Promise<PromoCodeValidationResult> {
    const promoCodeData = await this.promoCodeRepo.findByCode(tenantId, code);
    if (!promoCodeData) {
      return { valid: false, error: 'Kode promo tidak ditemukan' };
    }

    const promoCode = PromoCode.create(promoCodeData);
    if (!promoCode.isValid()) {
      return { valid: false, error: 'Kode promo sudah tidak berlaku' };
    }

    const config = await this.discountConfigRepo.findByTenantId(tenantId);
    if (!config?.enabled) {
      return { valid: false, error: 'Diskon tidak aktif' };
    }

    const rule = config.rules.find((r) => r.id === promoCode.getRuleId());
    if (!rule || !rule.active) {
      return { valid: false, error: 'Aturan promo tidak ditemukan' };
    }

    return {
      valid: true,
      promoCode,
      ruleName: rule.name,
      discountDescription: rule.effects.map((e) => `${e.type}(${JSON.stringify(e.config)})`).join(' + '),
    };
  }
}
