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

  async findByTenant(tenantId: string, filter?: { status?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }): Promise<{ orders: Order[]; total: number }> {
    const query: any = { tenantId };
    if (filter?.status) query.status = filter.status;
    if (filter?.dateFrom || filter?.dateTo) {
      query.createdAt = {};
      if (filter?.dateFrom) query.createdAt.$gte = new Date(filter.dateFrom);
      if (filter?.dateTo) query.createdAt.$lte = new Date(filter.dateTo);
    }

    const page = filter?.page || 1;
    const limit = Math.min(filter?.limit || 50, 100);
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

  async getDailySales(tenantId: string, date: string): Promise<{
    totalOrders: number;
    totalRevenue: number;
    totalItems: number;
    paymentBreakdown: Record<string, number>;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const match = {
      tenantId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: 'paid',
    };

    const [aggregation] = await this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          totalItems: { $sum: { $sum: '$items.quantity' } },
        },
      },
    ]);

    const paymentBreakdown = await this.model.aggregate([
      { $match: { ...match, paymentStatus: 'completed' } },
      {
        $group: {
          _id: '$paymentStatus',
          total: { $sum: '$total' },
        },
      },
    ]);

    return {
      totalOrders: aggregation?.totalOrders || 0,
      totalRevenue: aggregation?.totalRevenue || 0,
      totalItems: aggregation?.totalItems || 0,
      paymentBreakdown: { cash: (paymentBreakdown[0]?.total || 0) },
    };
  }

  async getSummary(tenantId: string): Promise<{
    todayRevenue: number;
    todayOrders: number;
    pendingOrders: number;
    lowStockCount: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [todayAgg] = await this.model.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const pendingCount = await this.model.countDocuments({
      tenantId,
      status: { $in: ['draft', 'confirmed'] },
    });

    return {
      todayRevenue: todayAgg?.totalRevenue || 0,
      todayOrders: todayAgg?.totalOrders || 0,
      pendingOrders: pendingCount,
      lowStockCount: 0,
    };
  }
}
