import { asClass, Lifetime } from 'awilix';
import { MongoDailyMetricRepository } from '../../core/reporting/infrastructure/persistence/MongoDailyMetricRepository';
import { ReportAggregation } from '../../core/reporting/infrastructure/aggregation/ReportAggregation';
import { ReportService } from '../../core/reporting/application/services/ReportService';
import { ReportExportService } from '../../core/reporting/application/services/ReportExportService';
import { ReportController } from '../../core/reporting/interfaces/http/controllers/ReportController';
import type { WiringContext } from './types';

/**
 * Registers the reporting domain: daily metrics, `ReportAggregation` (the
 * aggregation pipelines, injected with the raw models because they read several
 * collections at once), the report services, the PDF/XLSX exporter and the
 * report controller.
 *
 * `reportAggregation` is the widest single injector in the container — it takes
 * order, payment, product, stock-movement, tax and pricing models plus the
 * discount-configuration model — which is exactly why it belongs to one wiring
 * rather than being sprinkled across domains.
 */
export function registerReportingWiring({ container, models }: WiringContext): void {
  container.register({
    dailyMetricRepository: asClass(MongoDailyMetricRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.DailyMetricModel,
      }),
    }),
    reportAggregation: asClass(ReportAggregation, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderModel: models.OrderModel,
        shiftModel: models.ShiftModel,
        productModel: models.ProductModel,
        paymentModel: models.PaymentModel,
        refundModel: models.RefundModel,
        stockModel: models.StockModel,
        stockMovementModel: models.StockMovementModel,
      }),
    }),
    reportService: asClass(ReportService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        shiftRepository: container.resolve('shiftRepository'),
        dailyMetricRepository: container.resolve('dailyMetricRepository'),
        reportAggregation: container.resolve('reportAggregation'),
      }),
    }),
    reportExportService: asClass(ReportExportService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        reportService: container.resolve('reportService'),
        categoryRepository: container.resolve('categoryRepository'),
      }),
    }),
    reportController: asClass(ReportController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        reportService: container.resolve('reportService'),
        reportExportService: container.resolve('reportExportService'),
      }),
    }),
  });
}
