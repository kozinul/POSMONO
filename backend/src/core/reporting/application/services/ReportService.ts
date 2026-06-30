import { MongoOrderRepository } from '../../../ordering/infrastructure/persistence/MongoOrderRepository';
import { MongoShiftRepository } from '../../../pos/infrastructure/persistence/MongoShiftRepository';
import { PaymentService } from '../../../payment/application/services/PaymentService';

export class ReportService {
  constructor(
    private readonly orderRepository: MongoOrderRepository,
    private readonly shiftRepository: MongoShiftRepository,
    private readonly paymentService: PaymentService,
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

    return {
      date,
      totalOrders: sales.totalOrders,
      totalRevenue: sales.totalRevenue,
      totalItems: sales.totalItems,
      paymentBreakdown: sales.paymentBreakdown,
      shifts: shifts.map((s) => s.serialize()),
    };
  }

  async getSalesReport(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
  ) {
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

    return {
      dateFrom,
      dateTo,
      totalOrders: orders.total,
      totalRevenue,
      totalItems,
      orders: orders.orders.map((o) => o.serialize()),
    };
  }
}
