import { MongoOrderRepository } from '../../../ordering/infrastructure/persistence/MongoOrderRepository';
import { MongoShiftRepository } from '../../../pos/infrastructure/persistence/MongoShiftRepository';
import { MongoDailyMetricRepository } from '../../infrastructure/persistence/MongoDailyMetricRepository';
import { ReportAggregation } from '../../infrastructure/aggregation/ReportAggregation';
import { DailyMetric } from '../../domain/Report';
import { ICarriedOverBill } from '../../../pos/domain/Shift';
import { NotFoundError } from '../../../../@shared/infrastructure/error/AppError';

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

export class ReportService {
  constructor(
    private readonly orderRepository: MongoOrderRepository,
    private readonly shiftRepository: MongoShiftRepository,
    private readonly dailyMetricRepository: MongoDailyMetricRepository,
    private readonly reportAggregation: ReportAggregation,
  ) {}

  async getDashboardSummary(tenantId: string) {
    const summary = await this.orderRepository.getSummary(tenantId);

    const recentOrders = await this.orderRepository.findByTenant(tenantId, {
      limit: 5,
    });

    return {
      todayRevenue: summary.todayRevenue,
      totalRounding: summary.totalRounding,
      todayOrders: summary.todayOrders,
      pendingOrders: summary.pendingOrders,
      lowStockCount: summary.lowStockCount,
      recentOrders: recentOrders.orders.map((o) => o.serialize()),
    };
  }

  async getDailyReport(tenantId: string, date: string) {
    const sales = await this.orderRepository.getDailySales(tenantId, date);
    const shifts = await this.shiftRepository.findByDate(tenantId, date);

    const topProducts = await this.reportAggregation.getTopProductsAggregation(tenantId, date, 10);
    const paymentBreakdown = await this.reportAggregation.getPaymentBreakdownAggregation(tenantId, date);

    return {
      date,
      totalOrders: sales.totalOrders,
      totalRevenue: sales.totalRevenue,
      totalRounding: sales.totalRounding,
      totalItems: sales.totalItems,
      paymentBreakdown,
      topProducts,
      shifts: shifts.map((s) => s.serialize()),
    };
  }

  async getSalesReport(tenantId: string, dateFrom: string, dateTo: string) {
    const orders = await this.orderRepository.findByTenant(tenantId, {
      dateFrom,
      dateTo,
      status: ['paid', 'completed'],
    });

    const totalRevenue = orders.orders.reduce(
      (sum, o) => sum + o.serialize().total + (o.serialize().roundingAdjustment ?? 0),
      0,
    );
    const totalRounding = orders.orders.reduce(
      (sum, o) => sum + (o.serialize().roundingAdjustment ?? 0),
      0,
    );
    const totalItems = orders.orders.reduce(
      (sum, o) => sum + o.serialize().items.reduce((s, i) => s + i.quantity, 0),
      0,
    );

    const salesByCategory = await this.reportAggregation.getSalesByCategoryAggregation(tenantId, dateFrom, dateTo);
    const topProducts = await this.reportAggregation.getTopProductsAggregation(tenantId, dateFrom, 20);

    return {
      dateFrom,
      dateTo,
      totalOrders: orders.total,
      totalRevenue,
      totalRounding,
      totalItems,
      salesByCategory,
      topProducts,
      orders: orders.orders.map((o) => o.serialize()),
    };
  }

  async getCashierReport(tenantId: string, date: string) {
    const cashierPerformance = await this.reportAggregation.getCashierPerformanceAggregation(tenantId, date);
    const shifts = await this.shiftRepository.findByDate(tenantId, date);

    return {
      date,
      cashierPerformance,
      shifts: shifts.map((s) => s.serialize()),
    };
  }

  async getCashierReceiptsReport(tenantId: string, dateFrom: string, dateTo: string) {
    const result = await this.reportAggregation.getCashierReceiptsAggregation(tenantId, dateFrom, dateTo);
    return { dateFrom, dateTo, ...result };
  }

  async getSalesPerCashierReport(tenantId: string, dateFrom: string, dateTo: string) {
    const result = await this.reportAggregation.getSalesPerCashierAggregation(tenantId, dateFrom, dateTo);
    return { dateFrom, dateTo, ...result };
  }

  async getShiftReport(tenantId: string, shiftId: string) {
    const shift = await this.shiftRepository.findById(shiftId);
    if (!shift || shift.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Shift', shiftId);
    }

    const shiftData = shift.serialize();

    const sales = await this.reportAggregation.getShiftSalesAggregation({
      tenantId,
      fromAt: shiftData.openedAt,
      toAt: shiftData.closedAt ?? new Date(),
      shiftId,
    });

    const orders = await this.reportAggregation.getShiftOrdersAggregation(tenantId, shiftId);

    const totalRounding = orders.reduce(
      (sum, o: any) => sum + (o.roundingAdjustment ?? 0),
      0,
    );

    let inheritedCarriedBills: ICarriedOverBill[] = [];
    if (shiftData.status === 'open') {
      const previous = await this.shiftRepository.findLastClosedByCashierBefore(
        tenantId,
        shiftData.cashierId,
        shiftData.openedAt,
      );
      inheritedCarriedBills = previous?.serialize().carriedOverBills ?? [];
    }

    return {
      shift: shiftData,
      sales,
      orders,
      totalRounding,
      inheritedCarriedBills,
    };
  }

  async generateDailyMetric(tenantId: string, date: string): Promise<DailyMetric> {
    const existing = await this.dailyMetricRepository.findByDate(tenantId, date);
    
    const sales = await this.orderRepository.getDailySales(tenantId, date);
    const topProducts = await this.reportAggregation.getTopProductsAggregation(tenantId, date, 10);
    const paymentBreakdown = await this.reportAggregation.getPaymentBreakdownAggregation(tenantId, date);

    const metricData = {
      tenantId,
      date,
      metrics: {
        totalOrders: sales.totalOrders,
        totalRevenue: sales.totalRevenue,
        totalCustomers: sales.totalOrders,
        avgOrderValue: sales.totalOrders > 0 ? sales.totalRevenue / sales.totalOrders : 0,
        topProducts,
        paymentMethodBreakdown: paymentBreakdown,
      },
    };

    if (existing) {
      existing.update({ metrics: metricData.metrics });
      await this.dailyMetricRepository.save(existing);
      return existing;
    }

    const metric = DailyMetric.create(metricData);
    await this.dailyMetricRepository.save(metric);
    return metric;
  }

  async getDailyMetrics(tenantId: string, dateFrom: string, dateTo: string) {
    return this.dailyMetricRepository.findByDateRange(tenantId, dateFrom, dateTo);
  }

  async getSalesPerProduct(tenantId: string, dateFrom: string, dateTo: string) {
    return this.reportAggregation.getSalesPerProductAggregation(tenantId, dateFrom, dateTo);
  }

  async getBestSellers(tenantId: string, days: number = 7, limit: number = 20) {
    const capped = Math.max(1, Math.min(days, 365));
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - (capped - 1));

    const toStr = toDateString(dateTo);
    const fromStr = toDateString(dateFrom);

    const products = await this.reportAggregation.getBestSellersAggregation(
      tenantId,
      fromStr,
      toStr,
      limit,
    );

    return {
      dateFrom: fromStr,
      dateTo: toStr,
      days: capped,
      products,
    };
  }

  async getFinanceReport(tenantId: string, dateFrom: string, dateTo: string) {
    const finance = await this.reportAggregation.getFinanceAggregation(tenantId, dateFrom, dateTo);

    return {
      dateFrom,
      dateTo,
      totalOrders: finance.totalOrders,
      totalRevenue: finance.totalRevenue,
      netRevenue: finance.netRevenue,
      totalTax: finance.totalTax,
      totalServiceCharge: finance.totalServiceCharge,
      totalDiscount: finance.totalDiscount,
      totalRounding: finance.totalRounding,
      categories: finance.categories,
    };
  }

  async getRefundReport(tenantId: string, dateFrom: string, dateTo: string) {
    const rows = await this.reportAggregation.getRefundAggregation(tenantId, dateFrom, dateTo);

    return {
      dateFrom,
      dateTo,
      totalRefunds: rows.length,
      totalAmount: rows.reduce((sum, r) => sum + r.amount, 0),
      refunds: rows,
    };
  }

  async getRefundDetail(tenantId: string, refundId: string) {
    return this.reportAggregation.getRefundByIdAggregation(tenantId, refundId);
  }
}
