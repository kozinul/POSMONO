import { Model } from 'mongoose';

export interface IPaymentBreakdownGroup {
  method: string;
  code: string;
  amount: number;
}

export class ReportAggregation {
  constructor(
    private readonly orderModel: Model<any>,
    private readonly shiftModel: Model<any>,
    private readonly productModel: Model<any>,
    private readonly paymentModel: Model<any>,
    private readonly refundModel?: Model<any>,
    private readonly stockModel?: Model<any>,
    private readonly stockMovementModel?: Model<any>,
  ) {}

  async getDailySalesAggregation(tenantId: string, date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.orderModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['paid', 'completed'] },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          totalItems: { $sum: { $sum: '$items.quantity' } },
          avgOrderValue: { $avg: '$total' },
        },
      },
    ]);

    return result[0] || { totalOrders: 0, totalRevenue: 0, totalItems: 0, avgOrderValue: 0 };
  }

  async getPaymentBreakdownAggregation(tenantId: string, date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.paymentModel.aggregate([
      {
        $match: {
          tenantId,
          status: 'completed',
          paidAt: { $gte: startOfDay, $lte: endOfDay },
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
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'order._id': { $exists: false } },
            { 'order.status': { $in: ['paid', 'completed'] } },
          ],
        },
      },
      {
        $group: {
          _id: '$method',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    return result.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.total;
      return acc;
    }, {});
  }

  async getShiftSalesAggregation(params: {
    tenantId: string;
    fromAt: Date;
    toAt: Date;
    shiftId?: string | null;
  }): Promise<{
    totalSales: number;
    cashSales: number;
    nonCashSales: number;
    totalTransactions: number;
    paymentBreakdown: IPaymentBreakdownGroup[];
  }> {
    const { tenantId, fromAt, toAt, shiftId } = params;

    const timeMatch = { paidAt: { $gte: fromAt, $lte: toAt } };
    const shiftMatch = shiftId ? { shiftId } : {};
    const rows = await this.paymentModel.aggregate([
      {
        $match: {
          tenantId,
          status: 'completed',
          ...timeMatch,
          ...shiftMatch,
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
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'order._id': { $exists: false } },
            { 'order.status': { $in: ['paid', 'completed'] } },
          ],
        },
      },
      {
        $group: {
          _id: '$method',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalSales = 0;
    let cashSales = 0;
    let nonCashSales = 0;
    let totalTransactions = 0;
    const breakdownMap = new Map<string, IPaymentBreakdownGroup>();

    for (const row of rows) {
      totalSales += row.total;
      totalTransactions += row.count;
      if (row._id === 'cash') cashSales += row.total;
      else nonCashSales += row.total;
      breakdownMap.set(row._id, { method: row._id, code: row._id, amount: row.total });
    }

    return {
      totalSales: Math.round(totalSales),
      cashSales: Math.round(cashSales),
      nonCashSales: Math.round(nonCashSales),
      totalTransactions,
      paymentBreakdown: Array.from(breakdownMap.values()),
    };
  }

  async getShiftOrdersAggregation(tenantId: string, shiftId: string) {
    return this.paymentModel.aggregate([
      { $match: { tenantId, shiftId, status: 'completed' } },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'order._id': { $exists: true },
          'order.status': { $in: ['paid', 'completed'] },
        },
      },
      { $replaceRoot: { newRoot: '$order' } },
      { $sort: { createdAt: 1 } },
    ]);
  }

  async getTopProductsAggregation(tenantId: string, date: string, limit: number = 10) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.orderModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['paid', 'completed'] },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.productName' },
          total: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
        },
      },
      { $sort: { total: -1 } },
      { $limit: limit },
    ]);

    return result.map((item: any) => ({
      productId: item._id,
      name: item.name,
      total: item.total,
      revenue: item.revenue,
    }));
  }

  async getBestSellersAggregation(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    limit: number = 20,
  ) {
    const startOfDay = new Date(dateFrom);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.orderModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['paid', 'completed'] },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.productName' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
        },
      },
      { $sort: { quantity: -1, revenue: -1 } },
      { $limit: limit },
    ]);

    return result.map((item: any) => ({
      productId: item._id,
      name: item.name,
      quantity: item.quantity,
      revenue: item.revenue,
    }));
  }

  async getCashierPerformanceAggregation(tenantId: string, date: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.orderModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['paid', 'completed'] },
        },
      },
      {
        $group: {
          _id: '$cashierId',
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: { $add: [{ $ifNull: ['$roundingAdjustment', 0] }, '$total'] },
          },
          avgOrderValue: {
            $avg: { $add: [{ $ifNull: ['$roundingAdjustment', 0] }, '$total'] },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    return result.map((item: any) => ({
      cashierId: item._id,
      totalOrders: item.totalOrders,
      totalRevenue: item.totalRevenue,
      avgOrderValue: item.avgOrderValue,
    }));
  }

  async getSalesByCategoryAggregation(tenantId: string, dateFrom: string, dateTo: string) {
    const startOfDay = new Date(dateFrom);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.orderModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['paid', 'completed'] },
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$product.categoryId',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
          totalItems: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    return result.map((item: any) => ({
      categoryId: item._id,
      totalOrders: item.totalOrders,
      totalRevenue: item.totalRevenue,
      totalItems: item.totalItems,
    }));
  }

  async getFinanceAggregation(tenantId: string, dateFrom: string, dateTo: string) {
    const startOfDay = new Date(dateFrom);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);

    const match = {
      tenantId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['paid', 'completed'] },
    };

    const [totals] = await this.orderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: { $add: [{ $ifNull: ['$roundingAdjustment', 0] }, '$total'] },
          },
          netRevenue: {
            $sum: {
              $subtract: [
                { $subtract: [{ $add: [{ $ifNull: ['$roundingAdjustment', 0] }, '$total'] }, '$tax'] },
                { $ifNull: ['$serviceCharge', 0] },
              ],
            },
          },
          totalTax: { $sum: { $ifNull: ['$tax', 0] } },
          totalServiceCharge: { $sum: { $ifNull: ['$serviceCharge', 0] } },
          totalDiscount: {
            $sum: { $max: [{ $ifNull: ['$discount', 0] }, { $ifNull: ['$discountTotal', 0] }] },
          },
          totalRounding: { $sum: { $ifNull: ['$roundingAdjustment', 0] } },
        },
      },
    ]);

    const categories = await this.orderModel.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$product.categoryId',
          totalOrders: { $sum: 1 },
          totalItems: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
          dpp: { $sum: { $ifNull: ['$items.dpp', 0] } },
          tax: { $sum: { $ifNull: ['$items.tax.amount', 0] } },
          serviceCharge: { $sum: { $ifNull: ['$items.serviceCharge', 0] } },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    return {
      totalOrders: totals?.totalOrders ?? 0,
      totalRevenue: totals?.totalRevenue ?? 0,
      netRevenue: totals?.netRevenue ?? 0,
      totalTax: totals?.totalTax ?? 0,
      totalServiceCharge: totals?.totalServiceCharge ?? 0,
      totalDiscount: totals?.totalDiscount ?? 0,
      totalRounding: totals?.totalRounding ?? 0,
      categories: categories.map((item: any) => ({
        categoryId: item._id,
        totalOrders: item.totalOrders,
        totalItems: item.totalItems,
        revenue: item.revenue,
        dpp:
          item.dpp > 0
            ? Math.round(item.dpp)
            : Math.round(item.revenue - item.tax - item.serviceCharge),
        tax: Math.round(item.tax),
        serviceCharge: Math.round(item.serviceCharge),
      })),
    };
  }

  async getSalesPerProductAggregation(tenantId: string, dateFrom: string, dateTo: string) {
    const startOfDay = new Date(dateFrom);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);

    const matched = await this.orderModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['paid', 'completed'] },
        },
      },
      {
        $facet: {
          products: [
            { $unwind: '$items' },
            {
              $group: {
                _id: { productId: '$items.productId', productName: '$items.productName' },
                quantity: { $sum: '$items.quantity' },
                totalSales: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
                totalDpp: { $sum: { $ifNull: ['$items.dpp', 0] } },
                totalTax: { $sum: { $ifNull: ['$items.tax.amount', 0] } },
                totalSC: { $sum: { $ifNull: ['$items.serviceCharge', 0] } },
                transactions: {
                  $push: {
                    orderId: '$orderNumber',
                    createdAt: '$createdAt',
                    quantity: '$items.quantity',
                    unitPrice: '$items.unitPrice',
                    dpp: { $ifNull: ['$items.dpp', 0] },
                    serviceCharge: { $ifNull: ['$items.serviceCharge', 0] },
                    tax: { $ifNull: ['$items.tax.amount', 0] },
                  },
                },
              },
            },
            { $sort: { totalSales: -1 } },
          ],
          rounding: [
            {
              $group: {
                _id: null,
                totalRounding: { $sum: { $ifNull: ['$roundingAdjustment', 0] } },
              },
            },
          ],
        },
      },
    ]);

    const facet = matched[0];
    const rows = (facet?.products ?? []).map((r: any) => ({
      productId: r._id.productId,
      productName: r._id.productName,
      quantity: r.quantity,
      totalSales: r.totalSales,
      dpp: r.totalDpp > 0 ? Math.round(r.totalDpp) : Math.round(r.totalSales - r.totalTax - r.totalSC),
      serviceCharge: Math.round(r.totalSC),
      tax: r.totalTax,
      transactions: r.transactions.map((t: any) => ({
        orderId: t.orderId,
        createdAt: t.createdAt,
        quantity: t.quantity,
        unitPrice: t.unitPrice,
        dpp: Math.round(t.dpp),
        serviceCharge: Math.round(t.serviceCharge),
        tax: t.tax,
      })),
    }));

    return {
      rows,
      totalRounding: facet?.rounding?.[0]?.totalRounding ?? 0,
    };
  }

  async getCashierReceiptsAggregation(tenantId: string, dateFrom: string, dateTo: string) {
    const startOfDay = new Date(dateFrom);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);

    const rows = await this.paymentModel.aggregate([
      {
        $match: {
          tenantId,
          status: 'completed',
          paidAt: { $gte: startOfDay, $lte: endOfDay },
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
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'order._id': { $exists: false } },
            { 'order.status': { $in: ['paid', 'completed'] } },
          ],
        },
      },
      {
        $group: {
          _id: {
            cashierId: { $ifNull: ['$order.cashierId', 'unknown'] },
            method: '$method',
          },
          cashierName: { $first: '$order.cashierName' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const cashierMap = new Map<string, any>();
    for (const r of rows as any[]) {
      const id = String(r._id.cashierId);
      if (!cashierMap.has(id)) {
        cashierMap.set(id, {
          cashierId: r._id.cashierId,
          cashierName: r.cashierName || 'Kasir',
          methods: [],
          total: 0,
          totalTransactions: 0,
        });
      }
      const entry = cashierMap.get(id);
      entry.methods.push({ method: r._id.method, total: Math.round(r.total), count: r.count });
      entry.total += Math.round(r.total);
      entry.totalTransactions += r.count;
    }

    const cashiers = Array.from(cashierMap.values()).sort(
      (a, b) => b.total - a.total,
    );

    const methodTotals = new Map<string, number>();
    let total = 0;
    let totalTransactions = 0;
    for (const c of cashiers) {
      total += c.total;
      totalTransactions += c.totalTransactions;
      for (const m of c.methods) {
        methodTotals.set(m.method, (methodTotals.get(m.method) ?? 0) + m.total);
      }
    }

    const totals = {
      total: Math.round(total),
      totalTransactions,
      methods: Array.from(methodTotals.entries()).map(([method, amount]) => ({
        method,
        total: Math.round(amount),
      })),
    };

    return { cashiers, totals };
  }

  async getSalesPerCashierAggregation(tenantId: string, dateFrom: string, dateTo: string) {
    const startOfDay = new Date(dateFrom);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);

    const matched = await this.orderModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['paid', 'completed'] },
        },
      },
      {
        $facet: {
          orders: [
            {
              $group: {
                _id: { $ifNull: ['$cashierId', 'unknown'] },
                cashierName: { $first: '$cashierName' },
                totalOrders: { $sum: 1 },
                totalRevenue: {
                  $sum: { $add: [{ $ifNull: ['$roundingAdjustment', 0] }, '$total'] },
                },
                dpp: { $sum: { $ifNull: ['$dppTotal', 0] } },
                serviceCharge: { $sum: { $ifNull: ['$serviceCharge', 0] } },
                tax: { $sum: { $ifNull: ['$tax', 0] } },
              },
            },
          ],
          items: [
            { $unwind: '$items' },
            {
              $group: {
                _id: { $ifNull: ['$cashierId', 'unknown'] },
                totalItems: { $sum: '$items.quantity' },
              },
            },
          ],
        },
      },
    ]);

    const facet = matched[0];
    const itemsById = new Map<string, number>((facet?.items ?? []).map((i: any) => [String(i._id), i.totalItems]));

    const cashiers: Array<{
      cashierId: unknown;
      cashierName: string;
      totalOrders: number;
      totalItems: number;
      totalRevenue: number;
      dpp: number;
      serviceCharge: number;
      tax: number;
      avgOrderValue: number;
    }> = ((facet?.orders ?? []) as any[]).map((r: any) => {
      const totalRevenue = r.totalRevenue;
      return {
        cashierId: r._id,
        cashierName: r.cashierName || 'Kasir',
        totalOrders: r.totalOrders,
        totalItems: itemsById.get(String(r._id)) ?? 0,
        totalRevenue: Math.round(totalRevenue),
        dpp: Math.round(r.dpp),
        serviceCharge: Math.round(r.serviceCharge),
        tax: Math.round(r.tax),
        avgOrderValue: r.totalOrders > 0 ? Math.round(totalRevenue / r.totalOrders) : 0,
      };
    });
    cashiers.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const totals = cashiers.reduce(
      (acc, c) => ({
        totalOrders: acc.totalOrders + c.totalOrders,
        totalItems: acc.totalItems + c.totalItems,
        totalRevenue: acc.totalRevenue + c.totalRevenue,
        dpp: acc.dpp + c.dpp,
        serviceCharge: acc.serviceCharge + c.serviceCharge,
        tax: acc.tax + c.tax,
      }),
      { totalOrders: 0, totalItems: 0, totalRevenue: 0, dpp: 0, serviceCharge: 0, tax: 0 },
    );

    return { cashiers, totals };
  }

  async getRefundAggregation(tenantId: string, dateFrom: string, dateTo: string) {
    const startOfDay = new Date(dateFrom);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);

    if (!this.refundModel) return [];

    return this.refundModel
      .aggregate([
        {
          $match: {
            tenantId,
            status: 'completed',
            refundedAt: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        {
          $lookup: {
            from: 'payments',
            localField: 'paymentId',
            foreignField: '_id',
            as: 'payment',
          },
        },
        { $unwind: { path: '$payment', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'order',
          },
        },
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
        { $sort: { refundedAt: -1 } },
      ])
      .then((rows: any[]) =>
        rows.map((r) => ({
          refundId: r._id,
          orderId: r.orderId,
          orderNumber: r.order?.orderNumber ?? '',
          cashierName: r.order?.cashierName ?? '',
          amount: r.amount,
          reason: r.reason,
          refundedBy: r.refundedBy,
          refundedByName: r.refundedByName,
          refundedAt: r.refundedAt,
          method: r.payment?.method ?? 'cash',
          referenceNumber: r.payment?.referenceNumber ?? '',
          provider: r.payment?.provider ?? null,
          cardLastFour: r.payment?.cardLastFour ?? null,
        })),
      );
  }

  async getRefundByIdAggregation(tenantId: string, refundId: string) {
    if (!this.refundModel) return null;

    const rows = await this.refundModel.aggregate([
      { $match: { _id: refundId, tenantId, status: 'completed' } },
      {
        $lookup: {
          from: 'payments',
          localField: 'paymentId',
          foreignField: '_id',
          as: 'payment',
        },
      },
      { $unwind: { path: '$payment', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
    ]);

    const r = rows[0];
    if (!r) return null;

    return {
      refundId: r._id,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? '',
      cashierName: r.order?.cashierName ?? '',
      orderItems: r.order?.items ?? [],
      orderTotal: r.order?.total ?? 0,
      roundingAdjustment: r.order?.roundingAdjustment ?? 0,
      amount: r.amount,
      reason: r.reason,
      refundedBy: r.refundedBy,
      refundedByName: r.refundedByName,
      refundedAt: r.refundedAt,
      method: r.payment?.method ?? 'cash',
      referenceNumber: r.payment?.referenceNumber ?? '',
      provider: r.payment?.provider ?? null,
      cardLastFour: r.payment?.cardLastFour ?? null,
    };
  }

  async getTopProductsPerFamilyAggregation(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    limitPerFamily: number = 5,
  ) {
    const startOfDay = new Date(dateFrom);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.orderModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['paid', 'completed'] },
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'families',
          localField: 'category.familyId',
          foreignField: '_id',
          as: 'family',
        },
      },
      { $unwind: { path: '$family', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            familyId: { $ifNull: ['$family._id', 'unknown'] },
            familyName: { $ifNull: ['$family.name', 'Lainnya'] },
            productId: '$items.productId',
            productName: '$items.productName',
          },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
        },
      },
      { $sort: { quantity: -1, revenue: -1 } },
      {
        $group: {
          _id: { familyId: '$_id.familyId', familyName: '$_id.familyName' },
          products: {
            $push: {
              productId: '$_id.productId',
              name: '$_id.productName',
              quantity: '$quantity',
              revenue: '$revenue',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          familyId: '$_id.familyId',
          familyName: '$_id.familyName',
          products: { $slice: ['$products', limitPerFamily] },
        },
      },
      { $sort: { familyName: 1 } },
    ]);

    return result;
  }

  async getActiveCashiersAggregation(tenantId: string) {
    const result = await this.shiftModel.aggregate([
      {
        $match: {
          tenantId,
          status: 'open',
        },
      },
      {
        $project: {
          _id: 0,
          cashierId: '$cashierId',
          cashierName: '$cashierName',
          openedAt: '$openedAt',
          registerId: '$registerId',
        },
      },
      { $sort: { openedAt: -1 } },
    ]);

    return result;
  }

  async getInventorySummaryAggregation(tenantId: string) {
    if (!this.stockModel) return [];

    const rows = await this.stockModel.aggregate([
      { $match: { tenantId } },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'warehouses',
          localField: 'warehouseId',
          foreignField: '_id',
          as: 'warehouse',
        },
      },
      { $unwind: { path: '$warehouse', preserveNullAndEmptyArrays: true } },
      { $sort: { 'product.name': 1, warehouseId: 1 } },
      {
        $project: {
          productId: 1,
          warehouseId: 1,
          warehouseName: { $ifNull: ['$warehouse.name', ''] },
          productName: { $ifNull: ['$product.name', ''] },
          sku: { $ifNull: ['$product.sku', ''] },
          categoryName: { $ifNull: ['$category.name', ''] },
          quantity: 1,
          reservedQuantity: { $ifNull: ['$reservedQuantity', 0] },
          minLevel: { $ifNull: ['$minLevel', 0] },
          maxLevel: { $ifNull: ['$maxLevel', 0] },
          costPrice: { $ifNull: ['$costPrice', 0] },
        },
      },
    ]);

    return rows.map((r: any) => {
      const quantity = r.quantity ?? 0;
      const reserved = r.reservedQuantity ?? 0;
      return {
        productId: String(r.productId),
        warehouseId: String(r.warehouseId),
        warehouseName: r.warehouseName ?? '',
        productName: r.productName ?? '',
        sku: r.sku ?? '',
        categoryName: r.categoryName ?? '',
        quantity,
        reservedQuantity: reserved,
        availableQuantity: quantity - reserved,
        minLevel: r.minLevel ?? 0,
        maxLevel: r.maxLevel ?? 0,
        costPrice: r.costPrice ?? 0,
        value: Math.round(quantity * (r.costPrice ?? 0) * 100) / 100,
        lowStock: quantity <= (r.minLevel ?? 0),
      };
    });
  }

  async getStockMovementTotalsAggregation(
    tenantId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    if (!this.stockMovementModel) return [];

    const match: any = { tenantId };
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        match.createdAt.$gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        match.createdAt.$lte = to;
      }
    }

    const rows = await this.stockMovementModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { productId: '$productId', warehouseId: '$warehouseId', type: '$type' },
          total: { $sum: '$quantity' },
        },
      },
    ]);

    return rows.map((r: any) => ({
      productId: String(r._id.productId),
      warehouseId: String(r._id.warehouseId),
      type: r._id.type,
      total: r.total,
    }));
  }

  async getCogsAggregation(tenantId: string, dateFrom: string, dateTo: string) {
    if (!this.stockMovementModel) return { totalCogs: 0, totalUnits: 0 };

    const startOfDay = new Date(dateFrom);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);

    const rows = await this.stockMovementModel.aggregate([
      {
        $match: {
          tenantId,
          type: 'out',
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: null,
          totalCogs: {
            $sum: {
              $multiply: [
                { $ifNull: ['$quantity', 0] },
                { $ifNull: ['$unitCost', 0] },
              ],
            },
          },
          totalUnits: { $sum: { $ifNull: ['$quantity', 0] } },
        },
      },
    ]);

    const row = rows[0] || ({} as any);
    return {
      totalCogs: Number(row.totalCogs ?? 0),
      totalUnits: Number(row.totalUnits ?? 0),
    };
  }
}
