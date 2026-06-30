import { Model, Document } from 'mongoose';
import { Role, IRole } from '../../domain/Role';

interface RoleDoc extends Document<string> {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
}

export class MongoRoleRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: RoleDoc): Role {
    return Role.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      description: doc.description,
      permissions: doc.permissions,
      isSystem: doc.isSystem,
      createdAt: doc.createdAt,
    } as IRole);
  }

  toPersistence(role: Role): Partial<RoleDoc> {
    const data = role.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      description: data.description,
      permissions: data.permissions,
      isSystem: data.isSystem,
    } as unknown as Partial<RoleDoc>;
  }

  async save(role: Role): Promise<void> {
    const data = this.toPersistence(role);
    await this.model.findOneAndUpdate({ _id: role.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
  }

  async findById(id: string): Promise<Role | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByName(tenantId: string, name: string): Promise<Role | null> {
    const doc = await this.model.findOne({ tenantId, name }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Role[]> {
    const docs = await this.model.find({ tenantId }).sort({ name: 1 }).exec();
    return docs.map((d: RoleDoc) => this.toDomain(d));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
