import { Model, Document } from 'mongoose';
import { Payment, IPayment } from '../../domain/Payment';

interface PaymentDoc extends Document<string> {
  _id: string;
  tenantId: string;
  orderId: string;
  amount: number;
  status: string;
  method: string;
  referenceNumber: string;
  metadata: Record<string, unknown>;
  paidAt: Date | null;
  createdAt: Date;
}

export class MongoPaymentRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: PaymentDoc): Payment {
    return Payment.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      orderId: doc.orderId,
      amount: doc.amount,
      status: doc.status as IPayment['status'],
      method: doc.method as IPayment['method'],
      referenceNumber: doc.referenceNumber,
      metadata: doc.metadata || {},
      paidAt: doc.paidAt,
      createdAt: doc.createdAt,
    } as IPayment);
  }

  toPersistence(payment: Payment): Partial<PaymentDoc> {
    const data = payment.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      orderId: data.orderId,
      amount: data.amount,
      status: data.status,
      method: data.method,
      referenceNumber: data.referenceNumber,
      metadata: data.metadata,
      paidAt: data.paidAt,
    } as unknown as Partial<PaymentDoc>;
  }

  async save(payment: Payment): Promise<void> {
    const data = this.toPersistence(payment);
    await this.model.findOneAndUpdate({ _id: payment.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    payment.clearEvents();
  }

  async findById(id: string): Promise<Payment | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByOrder(tenantId: string, orderId: string): Promise<Payment | null> {
    const doc = await this.model.findOne({ tenantId, orderId }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Payment[]> {
    const docs = await this.model.find({ tenantId }).sort({ createdAt: -1 }).exec();
    return docs.map((d: PaymentDoc) => this.toDomain(d));
  }
}
