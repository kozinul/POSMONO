import { Model, Document } from 'mongoose';
import { Warehouse, IWarehouse } from '../../domain/Warehouse';

interface WarehouseDoc extends Document<string> {
  _id: string;
  tenantId: string;
  name: string;
  address: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoWarehouseRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: WarehouseDoc): Warehouse {
    return Warehouse.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      address: doc.address,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IWarehouse);
  }

  toPersistence(warehouse: Warehouse): Partial<WarehouseDoc> {
    const data = warehouse.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      address: data.address,
      isActive: data.isActive,
    } as unknown as Partial<WarehouseDoc>;
  }

  async save(warehouse: Warehouse): Promise<void> {
    const data = this.toPersistence(warehouse);
    await this.model.findOneAndUpdate({ _id: warehouse.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    warehouse.clearEvents();
  }

  async findById(id: string): Promise<Warehouse | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Warehouse[]> {
    const docs = await this.model.find({ tenantId }).sort({ name: 1 }).exec();
    return docs.map((d: WarehouseDoc) => this.toDomain(d));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
