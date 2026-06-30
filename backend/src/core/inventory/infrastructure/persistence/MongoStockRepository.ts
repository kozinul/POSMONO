import { Model, Document } from 'mongoose';
import { Stock, IStock } from '../../domain/Stock';

interface StockDoc extends Document<string> {
  _id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  minLevel: number;
  maxLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoStockRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: StockDoc): Stock {
    return Stock.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      productId: doc.productId,
      variantId: doc.variantId,
      warehouseId: doc.warehouseId,
      quantity: doc.quantity,
      reservedQuantity: doc.reservedQuantity,
      minLevel: doc.minLevel,
      maxLevel: doc.maxLevel,
      updatedAt: doc.updatedAt,
    } as IStock);
  }

  toPersistence(stock: Stock): Partial<StockDoc> {
    const data = stock.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      productId: data.productId,
      variantId: data.variantId,
      warehouseId: data.warehouseId,
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
      minLevel: data.minLevel,
      maxLevel: data.maxLevel,
    } as unknown as Partial<StockDoc>;
  }

  async save(stock: Stock): Promise<void> {
    const data = this.toPersistence(stock);
    await this.model.findOneAndUpdate({ _id: stock.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    stock.clearEvents();
  }

  async findByProduct(tenantId: string, productId: string): Promise<Stock | null> {
    const doc = await this.model.findOne({ tenantId, productId }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Stock[]> {
    const docs = await this.model.find({ tenantId }).sort({ updatedAt: -1 }).exec();
    return docs.map((d: StockDoc) => this.toDomain(d));
  }

  async findLowStock(tenantId: string): Promise<Stock[]> {
    const docs = await this.model
      .find({ tenantId, $expr: { $lte: ['$quantity', '$minLevel'] } })
      .exec();
    return docs.map((d: StockDoc) => this.toDomain(d));
  }
}
