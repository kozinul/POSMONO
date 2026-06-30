import { Model, Document } from 'mongoose';
import { StockMovement, IStockMovement, StockMovementType } from '../../domain/StockMovement';

interface StockMovementDoc extends Document<string> {
  _id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  type: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  referenceType: string;
  referenceId: string;
  notes: string;
  userId: string;
  createdAt: Date;
}

export class MongoStockMovementRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: StockMovementDoc): StockMovement {
    return StockMovement.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      productId: doc.productId,
      variantId: doc.variantId,
      warehouseId: doc.warehouseId,
      type: doc.type as StockMovementType,
      quantity: doc.quantity,
      beforeQuantity: doc.beforeQuantity,
      afterQuantity: doc.afterQuantity,
      referenceType: doc.referenceType,
      referenceId: doc.referenceId,
      notes: doc.notes,
      userId: doc.userId,
      createdAt: doc.createdAt,
    } as IStockMovement);
  }

  async save(movement: StockMovement): Promise<void> {
    const data = movement.serialize();
    await this.model.create({
      _id: data.id,
      tenantId: data.tenantId,
      productId: data.productId,
      variantId: data.variantId,
      warehouseId: data.warehouseId,
      type: data.type,
      quantity: data.quantity,
      beforeQuantity: data.beforeQuantity,
      afterQuantity: data.afterQuantity,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      notes: data.notes,
      userId: data.userId,
    });
  }

  async findByTenant(tenantId: string, filter?: { productId?: string; type?: string }, page = 1, limit = 50): Promise<{ movements: StockMovement[]; total: number }> {
    const query: any = { tenantId };
    if (filter?.productId) query.productId = filter.productId;
    if (filter?.type) query.type = filter.type;

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(query),
    ]);

    return {
      movements: docs.map((d: StockMovementDoc) => this.toDomain(d)),
      total,
    };
  }
}
