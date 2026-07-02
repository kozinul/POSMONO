import { IPromoCode } from '../../domain/PromoCode';

export interface IPromoCodeRepository {
  findByCode(tenantId: string, code: string): Promise<IPromoCode | null>;
  findByRuleId(ruleId: string): Promise<IPromoCode[]>;
  save(promoCode: IPromoCode): Promise<void>;
  delete(id: string): Promise<void>;
}
