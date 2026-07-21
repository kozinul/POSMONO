import { Model, Document } from 'mongoose';
import { Family, IFamily } from '../../domain/Family';

interface FamilyDoc extends Document<string> {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoFamilyRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: FamilyDoc): Family {
    return Family.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      description: doc.description,
      sortOrder: doc.sortOrder,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IFamily);
  }

  toPersistence(family: Family): Partial<FamilyDoc> {
    const data = family.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      description: data.description,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    } as unknown as Partial<FamilyDoc>;
  }

  async save(family: Family): Promise<void> {
    const data = this.toPersistence(family);
    await this.model.findOneAndUpdate({ _id: family.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
  }

  async findById(id: string): Promise<Family | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Family[]> {
    const docs = await this.model.find({ tenantId }).sort({ sortOrder: 1 }).exec();
    return docs.map((d: FamilyDoc) => this.toDomain(d));
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}
