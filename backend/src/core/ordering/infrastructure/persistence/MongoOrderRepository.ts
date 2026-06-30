import { Model, Document } from 'mongoose';
import { OrderId } from '../../../../@shared/domain/Identifier';
import { Order, IOrder } from '../../domain/Order';

interface OrderDoc extends Document<string> {
  _id: string;
  tenantId: string;
  orderNumber: string;
  status: string;
  items: any[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: string;
  customerId: string | null;
  cashierId: string;
  notes: string;
  source: string;
  metadata: Record<string, unknown>;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoOrderRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: OrderDoc): Order {
    return Order.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      orderNumber: doc.orderNumber,
      status: doc.status as IOrder['status'],
      items: doc.items,
      subtotal: doc.subtotal,
      discount: doc.discount,
      tax: doc.tax,
      total: doc.total,
      paymentStatus: doc.paymentStatus as IOrder['paymentStatus'],
      customerId: doc.customerId,
      cashierId: doc.cashierId,
      notes: doc.notes,
      source: doc.source as IOrder['source'],
      metadata: doc.metadata || {},
      paidAt: doc.paidAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IOrder);
  }

  toPersistence(order: Order): Partial<OrderDoc> {
    const data = order.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      orderNumber: data.orderNumber,
      status: data.status,
      items: data.items,
      subtotal: data.subtotal,
      discount: data.discount,
      tax: data.tax,
      total: data.total,
      paymentStatus: data.paymentStatus,
      customerId: data.customerId,
      cashierId: data.cashierId,
      notes: data.notes,
      source: data.source,
      metadata: data.metadata,
      paidAt: data.paidAt,
    } as unknown as Partial<OrderDoc>;
  }

  async save(order: Order): Promise<void> {
    const data = this.toPersistence(order);
    await this.model.findOneAndUpdate({ _id: order.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    order.clearEvents();
  }

  async findById(id: string): Promise<Order | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string, filter?: { status?: string; page?: number; limit?: number }): Promise<{ orders: Order[]; total: number }> {
    const query: any = { tenantId };
    if (filter?.status) query.status = filter.status;

    const page = filter?.page || 1;
    const limit = filter?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(query),
    ]);

    return {
      orders: docs.map((d: OrderDoc) => this.toDomain(d)),
      total,
    };
  }
}
