import { Model, Document } from 'mongoose';
import { Station, IStation } from '../../domain/Station';

interface StationDoc extends Document<string> {
  _id: string;
  tenantId: string;
  outletId: string;
  name: string;
  kind: IStation['kind'];
  printerId: string | null;
  autoPrint: boolean;
  timerWarnMinutes: number;
  categoryIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoStationRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: StationDoc): Station {
    return Station.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      outletId: doc.outletId,
      name: doc.name,
      kind: doc.kind,
      printerId: doc.printerId ?? null,
      autoPrint: doc.autoPrint ?? false,
      timerWarnMinutes: doc.timerWarnMinutes ?? 10,
      categoryIds: [...(doc.categoryIds ?? [])],
      isActive: doc.isActive ?? true,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(station: Station): Record<string, unknown> {
    const data = station.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      outletId: data.outletId,
      name: data.name,
      kind: data.kind,
      printerId: data.printerId,
      autoPrint: data.autoPrint,
      timerWarnMinutes: data.timerWarnMinutes,
      categoryIds: data.categoryIds,
      isActive: data.isActive,
    };
  }

  async save(station: Station): Promise<void> {
    await this.model.findOneAndUpdate({ _id: station.id.toValue() }, this.toPersistence(station), {
      upsert: true,
      new: true,
    });
    station.clearEvents();
  }

  async findById(id: string): Promise<Station | null> {
    const doc = await this.model.findById(id).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<Station | null> {
    const doc = await this.model.findOne({ _id: id, tenantId }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByTenant(tenantId: string, outletId?: string | null): Promise<Station[]> {
    const query: Record<string, unknown> = { tenantId };
    if (outletId) query.outletId = outletId;
    const docs = await this.model.find(query).sort({ name: 1 }).exec();
    return docs.map((doc: StationDoc) => this.toDomain(doc));
  }

  async findActiveForOrder(tenantId: string, outletId: string | null): Promise<Station[]> {
    const query: Record<string, unknown> = { tenantId, isActive: true };
    if (outletId) query.outletId = outletId;
    const docs = await this.model.find(query).exec();
    return docs.map((doc: StationDoc) => this.toDomain(doc));
  }

  async findByName(tenantId: string, outletId: string, name: string): Promise<Station | null> {
    const doc = await this.model.findOne({ tenantId, outletId, name }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id, tenantId }).exec();
    return result.deletedCount > 0;
  }
}
