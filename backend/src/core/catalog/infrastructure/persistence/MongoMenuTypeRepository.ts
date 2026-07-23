import { Model, Document } from 'mongoose';
import { MenuType, IMenuType } from '../../domain/MenuType';

interface MenuTypeDoc extends Document<string> {
  _id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoMenuTypeRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: MenuTypeDoc): MenuType {
    return MenuType.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      sortOrder: doc.sortOrder,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IMenuType);
  }

  toPersistence(menuType: MenuType): Partial<MenuTypeDoc> {
    const data = menuType.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    } as unknown as Partial<MenuTypeDoc>;
  }

  async save(menuType: MenuType): Promise<void> {
    const data = this.toPersistence(menuType);
    await this.model.findOneAndUpdate({ _id: menuType.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
  }

  async findById(id: string): Promise<MenuType | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<MenuType[]> {
    const docs = await this.model.find({ tenantId }).sort({ sortOrder: 1 }).exec();
    return docs.map((d: MenuTypeDoc) => this.toDomain(d));
  }

  async findByName(tenantId: string, name: string): Promise<MenuType | null> {
    const doc = await this.model.findOne({ tenantId, name }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}
