import { Model, Document } from 'mongoose';
import { Refund, IRefund } from '../../domain/Refund';

interface RefundDoc extends Document<string> {
  _id: string;
  tenantId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  reason: string;
  status: string;
  refundedBy: string;
  refundedByName: string;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoRefundRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: RefundDoc): Refund {
    return Refund.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      paymentId: doc.paymentId,
      orderId: doc.orderId,
      amount: doc.amount,
      reason: doc.reason,
      status: doc.status as IRefund['status'],
      refundedBy: doc.refundedBy,
      refundedByName: doc.refundedByName,
      refundedAt: doc.refundedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(refund: Refund): Partial<RefundDoc> {
    const data = refund.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      paymentId: data.paymentId,
      orderId: data.orderId,
      amount: data.amount,
      reason: data.reason,
      status: data.status,
      refundedBy: data.refundedBy,
      refundedByName: data.refundedByName,
      refundedAt: data.refundedAt,
    } as unknown as Partial<RefundDoc>;
  }

  async save(refund: Refund): Promise<void> {
    const data = this.toPersistence(refund);
    await this.model.findOneAndUpdate({ _id: refund.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    refund.clearEvents();
  }

  async findById(id: string): Promise<Refund | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByPayment(tenantId: string, paymentId: string): Promise<Refund[]> {
    const docs = await this.model.find({ tenantId, paymentId }).sort({ createdAt: -1 }).exec();
    return docs.map((d: RefundDoc) => this.toDomain(d));
  }

  async findByOrder(tenantId: string, orderId: string): Promise<Refund[]> {
    const docs = await this.model.find({ tenantId, orderId }).sort({ createdAt: -1 }).exec();
    return docs.map((d: RefundDoc) => this.toDomain(d));
  }

  async findByTenant(tenantId: string): Promise<Refund[]> {
    const docs = await this.model.find({ tenantId }).sort({ createdAt: -1 }).exec();
    return docs.map((d: RefundDoc) => this.toDomain(d));
  }
}
