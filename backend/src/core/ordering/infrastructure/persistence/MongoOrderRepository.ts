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
  discountTotal: number;
  dppTotal: number;
  tax: number;
  taxDetails: any[];
  total: number;
  roundingAdjustment: number;
  roundedPayable: number;
  roundingMethod: string;
  serviceCharge: number;
  serviceChargeRate: number;
  paymentStatus: string;
  paymentBreakdown: any[];
  promotions: any[];
  customerId: string | null;
  customerName: string | null;
  cashierId: string;
  cashierName: string;
  tableNumber: string | null;
  transactionType: string;
  notes: string;
  source: string;
  voidedItems: any[];
  voidedAt: Date | null;
  voidedBy: string | null;
  voidedByName: string | null;
  voidReason: string | null;
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
      discountTotal: doc.discountTotal ?? 0,
      dppTotal: doc.dppTotal ?? 0,
      tax: doc.tax,
      taxDetails: doc.taxDetails ?? [],
      total: doc.total,
      roundingAdjustment: doc.roundingAdjustment ?? 0,
      roundedPayable: doc.roundedPayable ?? 0,
      roundingMethod: doc.roundingMethod ?? 'nearest',
      serviceCharge: doc.serviceCharge ?? 0,
      serviceChargeRate: doc.serviceChargeRate ?? 0,
      paymentStatus: doc.paymentStatus as IOrder['paymentStatus'],
      paymentBreakdown: doc.paymentBreakdown ?? [],
      promotions: doc.promotions ?? [],
      customerId: doc.customerId,
      customerName: doc.customerName ?? null,
      cashierId: doc.cashierId,
      cashierName: doc.cashierName ?? '',
      tableNumber: doc.tableNumber ?? null,
      transactionType: (doc.transactionType ?? 'dine_in') as IOrder['transactionType'],
      notes: doc.notes,
      source: doc.source as IOrder['source'],
      voidedItems: doc.voidedItems ?? [],
      voidedAt: doc.voidedAt ?? null,
      voidedBy: doc.voidedBy ?? null,
      voidedByName: doc.voidedByName ?? null,
      voidReason: doc.voidReason ?? null,
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
      discountTotal: data.discountTotal,
      dppTotal: data.dppTotal,
      tax: data.tax,
      taxDetails: data.taxDetails,
      total: data.total,
      roundingAdjustment: data.roundingAdjustment,
      roundedPayable: data.roundedPayable,
      roundingMethod: data.roundingMethod,
      serviceCharge: data.serviceCharge,
      serviceChargeRate: data.serviceChargeRate,
      paymentStatus: data.paymentStatus,
      paymentBreakdown: data.paymentBreakdown,
      promotions: data.promotions,
      customerId: data.customerId,
      customerName: data.customerName,
      cashierId: data.cashierId,
      cashierName: data.cashierName,
      tableNumber: data.tableNumber,
      transactionType: data.transactionType,
      notes: data.notes,
      source: data.source,
      voidedItems: data.voidedItems,
      voidedAt: data.voidedAt,
      voidedBy: data.voidedBy,
      voidedByName: data.voidedByName,
      voidReason: data.voidReason,
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
