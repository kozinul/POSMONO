import { Model, Document } from 'mongoose';
import { MongoRepository } from '../../../../@shared/infrastructure/database/MongoRepository';
import { UserId } from '../../../../@shared/domain/Identifier';
import { User, IUser } from '../../domain/User';

interface UserDoc extends Document<string> {
  _id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  displayName: string;
  roleId: string;
  outletIds: string[];
  isActive: boolean;
  lastLoginAt: Date | null;
  pin: string | null;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoUserRepository extends MongoRepository<User, UserId, UserDoc> {
  protected model: Model<any>;

  constructor(model: Model<any>) {
    super();
    this.model = model;
  }

  toDomain(doc: UserDoc): User {
    return User.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      email: doc.email,
      passwordHash: doc.passwordHash,
      displayName: doc.displayName,
      roleId: doc.roleId,
      outletIds: doc.outletIds ?? [],
      isActive: doc.isActive,
      lastLoginAt: doc.lastLoginAt,
      pin: doc.pin ?? null,
      preferences: doc.preferences || {},
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IUser);
  }

  toPersistence(user: User): Partial<UserDoc> {
    const data = user.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      email: data.email,
      passwordHash: data.passwordHash,
      displayName: data.displayName,
      roleId: data.roleId,
      outletIds: data.outletIds ?? [],
      isActive: data.isActive,
      lastLoginAt: data.lastLoginAt,
      pin: data.pin ?? null,
      preferences: data.preferences,
    } as unknown as Partial<UserDoc>;
  }

  async findByIdRaw(id: string): Promise<User | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const doc = await this.model.findOne({ email, tenantId }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByEmailGlobal(email: string): Promise<User | null> {
    const doc = await this.model.findOne({ email }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<User | null> {
    const doc = await this.model.findOne({ _id: id, tenantId }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<User[]> {
    const docs = await this.model.find({ tenantId }).sort({ createdAt: -1 }).exec();
    return docs.map((d: UserDoc) => this.toDomain(d));
  }
}
