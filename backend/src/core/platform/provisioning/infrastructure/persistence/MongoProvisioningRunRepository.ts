import { Model, Document } from 'mongoose';
import {
  ProvisioningRun,
  IProvisioningRun,
  IProvisioningStep,
} from '../../domain/ProvisioningRun';

interface ProvisioningRunDoc extends Document<string> {
  _id: string;
  requestId: string;
  idempotencyKey: string | null;
  tenantName: string;
  ownerEmail: string;
  hubId: string | null;
  mode: 'standalone' | 'hub';
  steps: IProvisioningStep[];
  overallStatus: 'success' | 'failed';
  durationMs: number;
  rolledBack: boolean;
  tenantId: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: Date;
}

export interface ProvisioningRunFilter {
  tenantName?: string;
  tenantId?: string;
  ownerEmail?: string;
  overallStatus?: 'success' | 'failed';
  limit?: number;
  skip?: number;
}

export class MongoProvisioningRunRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: ProvisioningRunDoc): ProvisioningRun {
    return ProvisioningRun.hydrate({
      id: doc._id || doc.id,
      requestId: doc.requestId,
      idempotencyKey: doc.idempotencyKey ?? null,
      tenantName: doc.tenantName,
      ownerEmail: doc.ownerEmail,
      hubId: doc.hubId ?? null,
      mode: doc.mode,
      steps: doc.steps ?? [],
      overallStatus: doc.overallStatus,
      durationMs: doc.durationMs,
      rolledBack: doc.rolledBack,
      tenantId: doc.tenantId ?? null,
      result: doc.result ?? null,
      error: doc.error ?? null,
      createdAt: doc.createdAt,
    } as IProvisioningRun);
  }

  toPersistence(run: ProvisioningRun): Partial<ProvisioningRunDoc> {
    const data = run.serialize();
    return {
      _id: data.id,
      requestId: data.requestId,
      idempotencyKey: data.idempotencyKey ?? undefined,
      tenantName: data.tenantName,
      ownerEmail: data.ownerEmail,
      hubId: data.hubId,
      mode: data.mode,
      steps: data.steps,
      overallStatus: data.overallStatus,
      durationMs: data.durationMs,
      rolledBack: data.rolledBack,
      tenantId: data.tenantId,
      result: data.result,
      error: data.error,
      createdAt: data.createdAt,
    };
  }

  async save(run: ProvisioningRun): Promise<void> {
    const persistence = this.toPersistence(run);
    await this.model.findByIdAndUpdate(persistence._id, persistence, {
      upsert: true,
      new: true,
    });
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<ProvisioningRun | null> {
    const doc = await this.model.findOne({ idempotencyKey }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByTenantId(tenantId: string, limit = 10): Promise<ProvisioningRun[]> {
    const docs = await this.model
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50))
      .exec();
    return docs.map((doc: ProvisioningRunDoc) => this.toDomain(doc));
  }

  async find(filter: ProvisioningRunFilter = {}): Promise<{
    items: ProvisioningRun[];
    total: number;
  }> {
    const query: any = {};
    if (filter.tenantName) {
      query.tenantName = new RegExp(filter.tenantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (filter.tenantId) query.tenantId = filter.tenantId;
    if (filter.ownerEmail) query.ownerEmail = filter.ownerEmail;
    if (filter.overallStatus) query.overallStatus = filter.overallStatus;

    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const skip = Math.max(filter.skip ?? 0, 0);

    const [docs, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return { items: docs.map((doc: ProvisioningRunDoc) => this.toDomain(doc)), total };
  }
}