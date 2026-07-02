import { IPromoCodeRepository } from './IPromoCodeRepository';
import { IPromoCode } from '../../domain/PromoCode';

export class InMemoryPromoCodeRepository implements IPromoCodeRepository {
  private store = new Map<string, IPromoCode>();

  async findByCode(tenantId: string, code: string): Promise<IPromoCode | null> {
    for (const pc of this.store.values()) {
      if (pc.tenantId === tenantId && pc.code === code.toUpperCase()) return pc;
    }
    return null;
  }

  async findByRuleId(ruleId: string): Promise<IPromoCode[]> {
    return Array.from(this.store.values()).filter((pc) => pc.ruleId === ruleId);
  }

  async save(promoCode: IPromoCode): Promise<void> {
    this.store.set(promoCode.id, promoCode);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
