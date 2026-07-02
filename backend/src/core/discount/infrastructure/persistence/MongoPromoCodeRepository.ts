import { IPromoCodeRepository } from './IPromoCodeRepository';
import { IPromoCode } from '../../domain/PromoCode';
import { PromoCodeModel } from './schemas/PromoCodeSchema';

function docToPromoCode(doc: any): IPromoCode {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: obj._id ?? obj.id,
    tenantId: obj.tenantId,
    code: obj.code,
    ruleId: obj.ruleId,
    maxUsageCount: obj.maxUsageCount ?? 0,
    currentUsageCount: obj.currentUsageCount ?? 0,
    isActive: obj.isActive ?? true,
    expiresAt: obj.expiresAt,
    createdAt: obj.createdAt ? String(obj.createdAt) : new Date().toISOString(),
    updatedAt: obj.updatedAt ? String(obj.updatedAt) : new Date().toISOString(),
  } as IPromoCode;
}

export class MongoPromoCodeRepository implements IPromoCodeRepository {
  async findByCode(tenantId: string, code: string): Promise<IPromoCode | null> {
    const doc = await PromoCodeModel.findOne({ tenantId, code: code.toUpperCase() }).exec();
    if (!doc) return null;
    return docToPromoCode(doc);
  }

  async findByRuleId(ruleId: string): Promise<IPromoCode[]> {
    const docs = await PromoCodeModel.find({ ruleId }).exec();
    return docs.map(docToPromoCode);
  }

  async save(promoCode: IPromoCode): Promise<void> {
    await PromoCodeModel.findByIdAndUpdate(
      promoCode.id,
      { $set: promoCode },
      { upsert: true, new: true },
    ).exec();
  }

  async delete(id: string): Promise<void> {
    await PromoCodeModel.findByIdAndDelete(id).exec();
  }
}
