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
  startedAt: Date | null;
  trialEndsAt: Date | null;
  autoRenew: boolean;
  assignedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
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
      startedAt: doc.startedAt ?? null,
      trialEndsAt: doc.trialEndsAt ?? null,
      autoRenew: doc.autoRenew ?? false,
      assignedAt: doc.assignedAt ?? null,
      cancelledAt: doc.cancelledAt || null,
      cancellationReason: doc.cancellationReason ?? null,
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
      startedAt: data.startedAt,
      trialEndsAt: data.trialEndsAt,
      autoRenew: data.autoRenew,
      assignedAt: data.assignedAt,
      cancelledAt: data.cancelledAt,
      cancellationReason: data.cancellationReason,
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

  /** Hub V2 Fase 19 — bulk read so a hub overview is not one query per tenant. */
  async findByTenantIds(tenantIds: string[]): Promise<Subscription[]> {
    if (tenantIds.length === 0) return [];
    const docs = await this.model.find({ tenantId: { $in: tenantIds } }).exec();
    return docs.map((doc: SubscriptionDoc) => this.toDomain(doc));
  }

  async save(sub: Subscription): Promise<void> {
    const persistence = this.toPersistence(sub);
    await this.model.findByIdAndUpdate(persistence._id, persistence, { upsert: true, new: true });
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }
}