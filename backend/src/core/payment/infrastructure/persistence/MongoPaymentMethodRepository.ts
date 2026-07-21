import { Model, Document } from 'mongoose';
import { PaymentMethod, IPaymentMethod } from '../../domain/PaymentMethod';

interface PaymentMethodDoc extends Document<string> {
  _id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  requiresReference: boolean;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoPaymentMethodRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: PaymentMethodDoc): PaymentMethod {
    return PaymentMethod.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      code: doc.code,
      description: doc.description,
      icon: doc.icon,
      color: doc.color,
      sortOrder: doc.sortOrder,
      isActive: doc.isActive,
      requiresReference: doc.requiresReference,
      config: doc.config,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IPaymentMethod);
  }

  toPersistence(method: PaymentMethod): Partial<PaymentMethodDoc> {
    const data = method.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      code: data.code,
      description: data.description,
      icon: data.icon,
      color: data.color,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      requiresReference: data.requiresReference,
      config: data.config,
    } as unknown as Partial<PaymentMethodDoc>;
  }

  async save(method: PaymentMethod): Promise<void> {
    const data = this.toPersistence(method);
    await this.model.findOneAndUpdate({ _id: method.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
  }

  async findById(id: string): Promise<PaymentMethod | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<PaymentMethod[]> {
    const docs = await this.model.find({ tenantId }).sort({ sortOrder: 1 }).exec();
    return docs.map((d: PaymentMethodDoc) => this.toDomain(d));
  }

  async findActiveByTenant(tenantId: string): Promise<PaymentMethod[]> {
    const docs = await this.model.find({ tenantId, isActive: true }).sort({ sortOrder: 1 }).exec();
    return docs.map((d: PaymentMethodDoc) => this.toDomain(d));
  }

  async findByCode(tenantId: string, code: string): Promise<PaymentMethod | null> {
    const doc = await this.model.findOne({ tenantId, code }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}
