import { Model, Document } from 'mongoose';
import { Category, ICategory } from '../../domain/Category';

interface CategoryDoc extends Document<string> {
  _id: string;
  tenantId: string;
  name: string;
  familyId: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoCategoryRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: CategoryDoc): Category {
    return Category.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      familyId: doc.familyId,
      parentId: doc.parentId,
      sortOrder: doc.sortOrder,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as ICategory);
  }

  toPersistence(category: Category): Partial<CategoryDoc> {
    const data = category.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      familyId: data.familyId,
      parentId: data.parentId,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    } as unknown as Partial<CategoryDoc>;
  }

  async findByFamily(familyId: string): Promise<Category[]> {
    const docs = await this.model.find({ familyId }).sort({ sortOrder: 1 }).exec();
    return docs.map((d: CategoryDoc) => this.toDomain(d));
  }

  async save(category: Category): Promise<void> {
    const data = this.toPersistence(category);
    await this.model.findOneAndUpdate({ _id: category.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
  }

  async findById(id: string): Promise<Category | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Category[]> {
    const docs = await this.model.find({ tenantId }).sort({ sortOrder: 1 }).exec();
    return docs.map((d: CategoryDoc) => this.toDomain(d));
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}
