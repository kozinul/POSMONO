import { Model, Document } from 'mongoose';
import { Promotion, IPromotion } from '../../domain/Promotion';

interface PromotionDoc extends Document<string> {
  _id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string;
  priority: number;
  exclusive: boolean;
  stackable: boolean;
  ruleLogic: string;
  rules: Array<{ type: string; params: Record<string, unknown> }>;
  effects: Array<{ type: string; value: number; target: string; targetProductId?: string; maxDiscount?: number }>;
  usageLimit: number | null;
  usedCount: number;
  minPurchase: number;
  isActive: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoPromotionRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: PromotionDoc): Promotion {
    return Promotion.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      code: doc.code,
      description: doc.description,
      priority: doc.priority,
      exclusive: doc.exclusive,
      stackable: doc.stackable,
      ruleLogic: doc.ruleLogic as IPromotion['ruleLogic'],
      rules: doc.rules ?? [],
      effects: doc.effects ?? [],
      usageLimit: doc.usageLimit,
      usedCount: doc.usedCount,
      minPurchase: doc.minPurchase,
      isActive: doc.isActive,
      validFrom: doc.validFrom,
      validUntil: doc.validUntil,
      metadata: doc.metadata ?? {},
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IPromotion);
  }

  toPersistence(promotion: Promotion): Partial<PromotionDoc> {
    const data = promotion.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      code: data.code,
      description: data.description,
      priority: data.priority,
      exclusive: data.exclusive,
      stackable: data.stackable,
      ruleLogic: data.ruleLogic,
      rules: data.rules,
      effects: data.effects,
      usageLimit: data.usageLimit,
      usedCount: data.usedCount,
      minPurchase: data.minPurchase,
      isActive: data.isActive,
      validFrom: data.validFrom,
      validUntil: data.validUntil,
      metadata: data.metadata,
    } as unknown as Partial<PromotionDoc>;
  }

  async save(promotion: Promotion): Promise<void> {
    const data = this.toPersistence(promotion);
    await this.model.findOneAndUpdate({ _id: promotion.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    promotion.clearEvents();
  }

  async findById(id: string): Promise<Promotion | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByCode(tenantId: string, code: string): Promise<Promotion | null> {
    const doc = await this.model.findOne({ tenantId, code }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string, options?: { page?: number; limit?: number; isActive?: boolean }): Promise<{ promotions: Promotion[]; total: number }> {
    const filter: any = { tenantId };
    if (options?.isActive !== undefined) filter.isActive = options.isActive;

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.model.find(filter).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      promotions: docs.map((d: PromotionDoc) => this.toDomain(d)),
      total,
    };
  }

  async findActive(tenantId: string): Promise<Promotion[]> {
    const now = new Date();
    const docs = await this.model.find({
      tenantId,
      isActive: true,
      $and: [
        {
          $or: [
            { validFrom: null },
            { validFrom: { $lte: now } },
          ],
        },
        {
          $or: [
            { validUntil: null },
            { validUntil: { $gte: now } },
          ],
        },
      ],
    }).sort({ priority: -1 }).exec();

    return docs.map((d: PromotionDoc) => this.toDomain(d));
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}
