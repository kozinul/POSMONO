import { Model, Document } from 'mongoose';
import {
  PlatformAuditLog,
  IPlatformAuditLog,
  PlatformAuditAction,
} from '../../domain/PlatformAuditLog';

interface PlatformAuditLogDoc extends Document<string> {
  _id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  tenantId: string | null;
  description: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  ip: string | null;
  requestId: string | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface PlatformAuditLogFilter {
  action?: string;
  tenantId?: string;
  actorEmail?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  skip?: number;
}

export class MongoPlatformAuditLogRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: PlatformAuditLogDoc): PlatformAuditLog {
    return PlatformAuditLog.hydrate({
      id: doc._id || doc.id,
      action: doc.action as PlatformAuditAction,
      actorId: doc.actorId,
      actorEmail: doc.actorEmail,
      actorRole: doc.actorRole,
      tenantId: doc.tenantId ?? null,
      description: doc.description,
      before: doc.before ?? null,
      after: doc.after ?? null,
      reason: doc.reason ?? null,
      ip: doc.ip ?? null,
      requestId: doc.requestId ?? null,
      occurredAt: doc.occurredAt,
      createdAt: doc.createdAt,
    } as IPlatformAuditLog);
  }

  toPersistence(log: PlatformAuditLog): Partial<PlatformAuditLogDoc> {
    const data = log.serialize();
    return {
      _id: data.id,
      action: data.action,
      actorId: data.actorId,
      actorEmail: data.actorEmail,
      actorRole: data.actorRole,
      tenantId: data.tenantId,
      description: data.description,
      before: data.before,
      after: data.after,
      reason: data.reason,
      ip: data.ip,
      requestId: data.requestId,
      occurredAt: data.occurredAt,
      createdAt: data.createdAt,
    };
  }

  async save(log: PlatformAuditLog): Promise<void> {
    const persistence = this.toPersistence(log);
    await this.model.findByIdAndUpdate(persistence._id, persistence, {
      upsert: true,
      new: true,
    });
  }

  async find(filter: PlatformAuditLogFilter = {}): Promise<{
    items: PlatformAuditLog[];
    total: number;
  }> {
    const query: any = {};
    if (filter.action) query.action = filter.action;
    if (filter.tenantId) query.tenantId = filter.tenantId;
    if (filter.actorEmail) {
      query.actorEmail = new RegExp(filter.actorEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (filter.from || filter.to) {
      query.occurredAt = {};
      if (filter.from) query.occurredAt.$gte = filter.from;
      if (filter.to) query.occurredAt.$lte = filter.to;
    }

    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const skip = Math.max(filter.skip ?? 0, 0);

    const [docs, total] = await Promise.all([
      this.model.find(query).sort({ occurredAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return { items: docs.map((doc: PlatformAuditLogDoc) => this.toDomain(doc)), total };
  }

  async findRecentByTenant(tenantId: string, limit = 10): Promise<PlatformAuditLog[]> {
    const docs = await this.model
      .find({ tenantId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .exec();
    return docs.map((doc: PlatformAuditLogDoc) => this.toDomain(doc));
  }
}