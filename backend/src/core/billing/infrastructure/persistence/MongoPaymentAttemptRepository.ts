import { Model, Document } from 'mongoose';
import {
  PaymentAttempt,
  IPaymentAttempt,
  PaymentAttemptStatus,
  IPaymentAttemptGateway,
} from '../../domain/PaymentAttempt';

interface PaymentAttemptDoc extends Document<string> {
  _id: string;
  tenantId: string;
  invoiceId: string;
  number: string | null;
  amount: number;
  method: string;
  status: string;
  gateway: IPaymentAttemptGateway | null;
  actorEmail: string | null;
  notes: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoPaymentAttemptRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: PaymentAttemptDoc): PaymentAttempt {
    return PaymentAttempt.hydrate({
      id: doc._id || doc.id,
      tenantId: doc.tenantId,
      invoiceId: doc.invoiceId,
      number: doc.number ?? null,
      amount: doc.amount,
      method: doc.method,
      status: doc.status as PaymentAttemptStatus,
      gateway: doc.gateway ?? null,
      actorEmail: doc.actorEmail ?? null,
      notes: doc.notes ?? null,
      startedAt: doc.startedAt,
      completedAt: doc.completedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IPaymentAttempt);
  }

  toPersistence(attempt: PaymentAttempt): Partial<PaymentAttemptDoc> {
    const data = attempt.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      invoiceId: data.invoiceId,
      number: data.number,
      amount: data.amount,
      method: data.method,
      status: data.status,
      gateway: data.gateway,
      actorEmail: data.actorEmail,
      notes: data.notes,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async save(attempt: PaymentAttempt): Promise<void> {
    const persistence = this.toPersistence(attempt);
    await this.model.findByIdAndUpdate(persistence._id, persistence, {
      upsert: true,
      new: true,
    });
  }

  /** Tenant-scoped find: a caller can never read another tenant's attempt. */
  async findById(tenantId: string, id: string): Promise<PaymentAttempt | null> {
    const doc = await this.model.findOne({ _id: id, tenantId }).exec();
    return doc ? this.toDomain(doc as PaymentAttemptDoc) : null;
  }

  async findByInvoiceId(tenantId: string, invoiceId: string): Promise<PaymentAttempt[]> {
    const docs = await this.model
      .find({ tenantId, invoiceId })
      .sort({ startedAt: -1 })
      .exec();
    return docs.map((doc: PaymentAttemptDoc) => this.toDomain(doc));
  }

  async findByTenantId(tenantId: string, limit = 100): Promise<PaymentAttempt[]> {
    const docs = await this.model
      .find({ tenantId })
      .sort({ startedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 500))
      .exec();
    return docs.map((doc: PaymentAttemptDoc) => this.toDomain(doc));
  }
}