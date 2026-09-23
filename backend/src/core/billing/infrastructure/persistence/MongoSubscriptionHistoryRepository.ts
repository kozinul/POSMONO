import { Model, Document } from 'mongoose';
import {
  SubscriptionHistory,
  ISubscriptionHistory,
  SubscriptionHistoryAction,
} from '../../domain/SubscriptionHistory';

interface SubscriptionHistoryDoc extends Document<string> {
  _id: string;
  tenantId: string;
  subscriptionId: string | null;
  action: string;
  planId: string | null;
  planName: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
  periodStartBefore: Date | null;
  periodEndBefore: Date | null;
  periodStartAfter: Date | null;
  periodEndAfter: Date | null;
  actorEmail: string | null;
  reason: string | null;
  at: Date;
  createdAt: Date;
}

export class MongoSubscriptionHistoryRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: SubscriptionHistoryDoc): SubscriptionHistory {
    return SubscriptionHistory.hydrate({
      id: doc._id || doc.id,
      tenantId: doc.tenantId,
      subscriptionId: doc.subscriptionId ?? null,
      action: doc.action as SubscriptionHistoryAction,
      planId: doc.planId ?? null,
      planName: doc.planName ?? null,
      statusBefore: doc.statusBefore ?? null,
      statusAfter: doc.statusAfter ?? null,
      periodStartBefore: doc.periodStartBefore ?? null,
      periodEndBefore: doc.periodEndBefore ?? null,
      periodStartAfter: doc.periodStartAfter ?? null,
      periodEndAfter: doc.periodEndAfter ?? null,
      actorEmail: doc.actorEmail ?? null,
      reason: doc.reason ?? null,
      at: doc.at,
      createdAt: doc.createdAt,
    } as ISubscriptionHistory);
  }

  toPersistence(history: SubscriptionHistory): Partial<SubscriptionHistoryDoc> {
    const data = history.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      subscriptionId: data.subscriptionId,
      action: data.action,
      planId: data.planId,
      planName: data.planName,
      statusBefore: data.statusBefore,
      statusAfter: data.statusAfter,
      periodStartBefore: data.periodStartBefore,
      periodEndBefore: data.periodEndBefore,
      periodStartAfter: data.periodStartAfter,
      periodEndAfter: data.periodEndAfter,
      actorEmail: data.actorEmail,
      reason: data.reason,
      at: data.at,
      createdAt: data.createdAt,
    };
  }

  async save(history: SubscriptionHistory): Promise<void> {
    const persistence = this.toPersistence(history);
    await this.model.findByIdAndUpdate(persistence._id, persistence, {
      upsert: true,
      new: true,
    });
  }

  async findByTenantId(tenantId: string, limit = 50): Promise<SubscriptionHistory[]> {
    const docs = await this.model
      .find({ tenantId })
      .sort({ at: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .exec();
    return docs.map((doc: SubscriptionHistoryDoc) => this.toDomain(doc));
  }
}