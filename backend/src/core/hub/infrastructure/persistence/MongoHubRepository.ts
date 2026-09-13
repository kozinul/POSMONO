import { Model, Document } from 'mongoose';
import { Hub, IHub } from '../../domain/Hub';

interface HubDoc extends Document<string> {
  _id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoHubRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: HubDoc): Hub {
    return Hub.hydrate({
      id: doc._id,
      name: doc.name,
      description: doc.description,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(hub: Hub): Partial<HubDoc> {
    const data = hub.serialize();
    return {
      _id: data.id,
      name: data.name,
      description: data.description,
      isActive: data.isActive,
    } as unknown as Partial<HubDoc>;
  }

  async save(hub: Hub, options?: { session?: any }): Promise<void> {
    const data = this.toPersistence(hub);
    await this.model.findOneAndUpdate({ _id: hub.id.toValue() }, data, {
      upsert: true,
      new: true,
      session: options?.session,
    });
    hub.clearEvents();
  }

  async findById(id: string): Promise<Hub | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByName(name: string): Promise<Hub | null> {
    const doc = await this.model.findOne({ name }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findAll(): Promise<Hub[]> {
    const docs = await this.model.find().sort({ name: 1 }).exec();
    return docs.map((doc: HubDoc) => this.toDomain(doc));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }
}
