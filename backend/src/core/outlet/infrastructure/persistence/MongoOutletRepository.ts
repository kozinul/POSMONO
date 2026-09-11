import { Model, Document } from 'mongoose';
import { Outlet, IOutlet } from '../../domain/Outlet';

interface OutletDoc extends Document<string> {
  _id: string;
  tenantId: string;
  name: string;
  address: string;
  phone: string;
  warehouseId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoOutletRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: OutletDoc): Outlet {
    return Outlet.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      address: doc.address,
      phone: doc.phone,
      warehouseId: doc.warehouseId,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(outlet: Outlet): Partial<OutletDoc> {
    const data = outlet.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      address: data.address,
      phone: data.phone,
      warehouseId: data.warehouseId,
      isActive: data.isActive,
    } as unknown as Partial<OutletDoc>;
  }

  async save(outlet: Outlet): Promise<void> {
    const data = this.toPersistence(outlet);
    await this.model.findOneAndUpdate({ _id: outlet.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    outlet.clearEvents();
  }

  async findById(id: string): Promise<Outlet | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Outlet[]> {
    const docs = await this.model.find({ tenantId }).sort({ name: 1 }).exec();
    return docs.map((doc: OutletDoc) => this.toDomain(doc));
  }

  async findActiveByTenant(tenantId: string): Promise<Outlet[]> {
    const docs = await this.model.find({ tenantId, isActive: true }).sort({ name: 1 }).exec();
    return docs.map((doc: OutletDoc) => this.toDomain(doc));
  }

  async findDefault(tenantId: string): Promise<Outlet | null> {
    const doc = await this.model.findOne({ tenantId, name: 'Outlet Utama' }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByWarehouse(warehouseId: string): Promise<Outlet | null> {
    const doc = await this.model.findOne({ warehouseId }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByName(tenantId: string, name: string): Promise<Outlet | null> {
    const doc = await this.model.findOne({ tenantId, name }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }
}
