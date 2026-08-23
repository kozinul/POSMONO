import { Model, Document } from 'mongoose';
import { Payment, IPayment } from '../../domain/Payment';

interface PaymentDoc extends Document<string> {
  _id: string;
  tenantId: string;
  orderId: string;
  amount: number;
  status: string;
  method: string;
  shiftId: string | null;
  referenceNumber: string;
  splitBills: Array<{ portion: number; amount: number; method: string; referenceNumber: string }>;
  qrCodeUrl: string | null;
  paymentTransactionId: string | null;
  provider: string | null;
  cardLastFour: string | null;
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
      shiftId: doc.shiftId ?? null,
      referenceNumber: doc.referenceNumber,
      splitBills: doc.splitBills ?? [],
      qrCodeUrl: doc.qrCodeUrl ?? null,
      paymentTransactionId: doc.paymentTransactionId ?? null,
      provider: doc.provider ?? null,
      cardLastFour: doc.cardLastFour ?? null,
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
      shiftId: data.shiftId,
      referenceNumber: data.referenceNumber,
      splitBills: data.splitBills,
      qrCodeUrl: data.qrCodeUrl,
      paymentTransactionId: data.paymentTransactionId,
      provider: data.provider,
      cardLastFour: data.cardLastFour,
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

  async findByReferenceNumber(tenantId: string, referenceNumber: string): Promise<Payment | null> {
    const doc = await this.model.findOne({ tenantId, referenceNumber }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Payment[]> {
    const docs = await this.model.find({ tenantId }).sort({ createdAt: -1 }).exec();
    return docs.map((d: PaymentDoc) => this.toDomain(d));
  }

  async findByOrderId(tenantId: string, orderId: string): Promise<Payment[]> {
    const docs = await this.model.find({ tenantId, orderId }).sort({ createdAt: -1 }).exec();
    return docs.map((d: PaymentDoc) => this.toDomain(d));
  }

  async findRefundable(tenantId: string, dateFrom?: string, dateTo?: string) {
    const range: Record<string, Date> = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        range.$gte = d;
      }
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
    }

    const timeMatch = Object.keys(range).length > 0
      ? { $or: [{ paidAt: range }, { createdAt: range }] }
      : {};

    const rows = await this.model.aggregate([
      { $match: { tenantId, status: 'completed', ...timeMatch } },
      {
        $lookup: {
          from: 'shifts',
          localField: 'shiftId',
          foreignField: '_id',
          as: 'shift',
        },
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      {
        $match: {
          'shift.status': 'closed',
          'order._id': { $exists: true },
          'order.status': { $in: ['paid', 'completed'] },
        },
      },
      { $unwind: { path: '$shift', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      { $sort: { paidAt: -1 } },
      { $limit: 200 },
    ]);

    return rows.map((r: any) => ({
      paymentId: r._id,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? '',
      cashierName: r.order?.cashierName ?? '',
      orderTotal: r.order?.total ?? 0,
      amount: r.amount,
      method: r.method,
      referenceNumber: r.referenceNumber ?? '',
      provider: r.provider ?? null,
      cardLastFour: r.cardLastFour ?? null,
      paidAt: r.paidAt,
      shiftClosedAt: r.shift?.closedAt ?? null,
    }));
  }
}
