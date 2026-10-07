import { Model, Document } from 'mongoose';
import {
  SubscriptionInvoice,
  ISubscriptionInvoice,
  SubscriptionInvoiceStatus,
  SubscriptionInvoiceReferenceType,
} from '../../domain/SubscriptionInvoice';

interface SubscriptionInvoiceDoc extends Document<string> {
  _id: string;
  tenantId: string;
  subscriptionId: string | null;
  number: string;
  status: string;
  amount: number;
  currency: 'IDR';
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  paidAt: Date | null;
  lineItems: Array<{ description: string; amount: number; quantity: number; total: number }>;
  referenceType: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoSubscriptionInvoiceRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: SubscriptionInvoiceDoc): SubscriptionInvoice {
    return SubscriptionInvoice.hydrate({
      id: doc._id || doc.id,
      tenantId: doc.tenantId,
      subscriptionId: doc.subscriptionId ?? null,
      number: doc.number,
      status: doc.status as SubscriptionInvoiceStatus,
      amount: doc.amount,
      currency: doc.currency ?? 'IDR',
      periodStart: doc.periodStart,
      periodEnd: doc.periodEnd,
      dueDate: doc.dueDate,
      paidAt: doc.paidAt ?? null,
      lineItems: doc.lineItems ?? [],
      referenceType: doc.referenceType as SubscriptionInvoiceReferenceType,
      notes: doc.notes ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as ISubscriptionInvoice);
  }

  toPersistence(invoice: SubscriptionInvoice): Partial<SubscriptionInvoiceDoc> {
    const data = invoice.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      subscriptionId: data.subscriptionId,
      number: data.number,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      dueDate: data.dueDate,
      paidAt: data.paidAt,
      lineItems: data.lineItems,
      referenceType: data.referenceType,
      notes: data.notes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async save(invoice: SubscriptionInvoice): Promise<void> {
    const persistence = this.toPersistence(invoice);
    await this.model.findByIdAndUpdate(persistence._id, persistence, {
      upsert: true,
      new: true,
    });
  }

  /** Tenant-scoped find: a caller can never read another tenant's invoice. */
  async findById(tenantId: string, id: string): Promise<SubscriptionInvoice | null> {
    const doc = await this.model.findOne({ _id: id, tenantId }).exec();
    return doc ? this.toDomain(doc as SubscriptionInvoiceDoc) : null;
  }

  async findByTenantId(tenantId: string, limit = 100): Promise<SubscriptionInvoice[]> {
    const docs = await this.model
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 500))
      .exec();
    return docs.map((doc: SubscriptionInvoiceDoc) => this.toDomain(doc));
  }

  async countByTenantId(tenantId: string): Promise<number> {
    return this.model.countDocuments({ tenantId }).exec();
  }

  /**
   * Atomic settle claim: only one caller can move a `pending`/`overdue`
   * invoice to `paid` for a given (tenant, invoice) pair. Returns the hydrated
   * invoice, or null when the invoice was already settled/cancelled — this is
   * what turns the double-pay race into a lost-and-failed second attempt.
   */
  async markPaid(tenantId: string, id: string): Promise<SubscriptionInvoice | null> {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: id, tenantId, status: { $nin: ['paid', 'cancelled'] } },
        { $set: { status: 'paid', paidAt: new Date(), updatedAt: new Date() } },
        { new: true },
      )
      .exec();
    return doc ? this.toDomain(doc as SubscriptionInvoiceDoc) : null;
  }

  /**
   * `SUB-<YYYY>-<seq>` per tenant (Batas #5 of MEMBER_AREA_PLAN.md): the
   * sequence is count+1 and the unique index on `{tenantId, number}` turns a
   * racing pair into an E11000 that the caller retries. No atomic counter.
   */
  async nextNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.countByTenantId(tenantId);
    return `SUB-${year}-${String(count + 1).padStart(3, '0')}`;
  }
}