import { Model, Document } from 'mongoose';
import { Subscription, ISubscription, SubscriptionStatus } from '../../domain/Subscription';

interface SubscriptionDoc extends Document<string> {
  _id: string;
  tenantId: string;
  planId: string;
  status: string;
  billingCycle: 'monthly' | 'annual' | 'custom';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoSubscriptionRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: SubscriptionDoc): Subscription {
    return Subscription.hydrate({
      id: doc._id || doc.id,
      tenantId: doc.tenantId,
      planId: doc.planId,
      status: doc.status as SubscriptionStatus,
      billingCycle: doc.billingCycle,
      currentPeriodStart: doc.currentPeriodStart,
      currentPeriodEnd: doc.currentPeriodEnd,
      cancelledAt: doc.cancelledAt || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as ISubscription);
  }

  toPersistence(sub: Subscription): Partial<SubscriptionDoc> {
    const data = sub.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      planId: data.planId,
      status: data.status,
      billingCycle: data.billingCycle,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelledAt: data.cancelledAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async findById(id: string): Promise<Subscription | null> {
    const doc = await this.model.findById(id).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    const doc = await this.model.findOne({ tenantId }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async save(sub: Subscription): Promise<void> {
    const persistence = this.toPersistence(sub);
    await this.model.findByIdAndUpdate(persistence._id, persistence, { upsert: true, new: true });
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }
}
