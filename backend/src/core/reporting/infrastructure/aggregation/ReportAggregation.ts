import { Model } from 'mongoose';

export class ReportAggregation {
  constructor(
    private readonly orderModel: Model<any>,
    private readonly shiftModel: Model<any>,
    private readonly productModel: Model<any>,
    private readonly paymentModel: Model<any>,
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
          totalRevenue: { $sum: '$total' },
          avgOrderValue: { $avg: '$total' },
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
          totalRevenue: { $sum: '$total' },
          netRevenue: {
            $sum: { $subtract: [{ $subtract: ['$total', '$tax'] }, { $ifNull: ['$serviceCharge', 0] }] },
          },
          totalTax: { $sum: { $ifNull: ['$tax', 0] } },
          totalServiceCharge: { $sum: { $ifNull: ['$serviceCharge', 0] } },
          totalDiscount: {
            $sum: { $add: [{ $ifNull: ['$discount', 0] }, { $ifNull: ['$discountTotal', 0] }] },
          },
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

    return this.orderModel.aggregate([
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
    ]).then((rows: any[]) =>
      rows.map((r) => ({
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
      })),
    );
  }
}
