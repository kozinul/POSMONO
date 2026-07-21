import { Model } from 'mongoose';

export class ReportAggregation {
  constructor(
    private readonly orderModel: Model<any>,
    private readonly shiftModel: Model<any>,
    private readonly productModel: Model<any>,
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

    const result = await this.orderModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['paid', 'completed'] },
        },
      },
      { $unwind: '$paymentBreakdown' },
      {
        $group: {
          _id: '$paymentBreakdown.method',
          total: { $sum: '$paymentBreakdown.amount' },
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
          name: { $first: '$items.name' },
          total: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
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
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
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
}
