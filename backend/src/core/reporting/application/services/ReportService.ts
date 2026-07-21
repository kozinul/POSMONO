import { MongoOrderRepository } from '../../../ordering/infrastructure/persistence/MongoOrderRepository';
import { MongoShiftRepository } from '../../../pos/infrastructure/persistence/MongoShiftRepository';
import { MongoDailyMetricRepository } from '../../infrastructure/persistence/MongoDailyMetricRepository';
import { ReportAggregation } from '../../infrastructure/aggregation/ReportAggregation';
import { DailyMetric } from '../../domain/Report';

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
      status: 'paid',
    });

    const totalRevenue = orders.orders.reduce((sum, o) => sum + o.serialize().total, 0);
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
}
