import { Model, Document } from 'mongoose';
import { Customer, ICustomer, IAddress } from '../../domain/Customer';

interface CustomerDoc extends Document<string> {
  _id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  address: IAddress | string;
  isMember: boolean;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt: Date | null;
  loyaltyPoints: number;
  tags: string[];
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoCustomerRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: CustomerDoc): Customer {
    return Customer.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      phone: doc.phone,
      email: doc.email,
      address: doc.address ?? '',
      isMember: doc.isMember,
      totalVisits: doc.totalVisits,
      totalSpent: doc.totalSpent,
      lastVisitAt: doc.lastVisitAt,
      loyaltyPoints: doc.loyaltyPoints ?? 0,
      tags: doc.tags ?? [],
      preferences: doc.preferences ?? {},
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as ICustomer);
  }

  toPersistence(customer: Customer): Partial<CustomerDoc> {
    const data = customer.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      isMember: data.isMember,
      totalVisits: data.totalVisits,
      totalSpent: data.totalSpent,
      lastVisitAt: data.lastVisitAt,
      loyaltyPoints: data.loyaltyPoints,
      tags: data.tags,
      preferences: data.preferences,
    } as unknown as Partial<CustomerDoc>;
  }

  async save(customer: Customer): Promise<void> {
    const data = this.toPersistence(customer);
    await this.model.findOneAndUpdate({ _id: customer.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    customer.clearEvents();
  }

  async findById(id: string): Promise<Customer | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string, options?: { page?: number; limit?: number }): Promise<{ customers: Customer[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.model.find({ tenantId }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments({ tenantId }).exec(),
    ]);

    return {
      customers: docs.map((d: CustomerDoc) => this.toDomain(d)),
      total,
    };
  }

  async findByPhone(tenantId: string, phone: string): Promise<Customer | null> {
    const doc = await this.model.findOne({ tenantId, phone }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async search(tenantId: string, query: string): Promise<Customer[]> {
    const docs = await this.model
      .find({
        tenantId,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { phone: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
        ],
      })
      .limit(20)
      .exec();
    return docs.map((d: CustomerDoc) => this.toDomain(d));
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}
