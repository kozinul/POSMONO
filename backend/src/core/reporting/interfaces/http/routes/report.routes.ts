import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { ReportController } from '../controllers/ReportController';

export function createReportRoutes(reportController: ReportController): Router {
  const router = Router();

  router.get('/dashboard', authenticate, asyncHandler(reportController.dashboard.bind(reportController)));
  router.get('/daily', authenticate, asyncHandler(reportController.daily.bind(reportController)));
  router.get('/sales', authenticate, asyncHandler(reportController.sales.bind(reportController)));
  router.get('/cashier', authenticate, asyncHandler(reportController.cashier.bind(reportController)));
  router.get('/daily-metrics', authenticate, asyncHandler(reportController.dailyMetrics.bind(reportController)));
  router.get('/sales-per-product', authenticate, asyncHandler(reportController.salesPerProduct.bind(reportController)));
  router.get('/finance', authenticate, asyncHandler(reportController.finance.bind(reportController)));
  router.post('/daily-metrics/generate', authenticate, asyncHandler(reportController.generateDailyMetric.bind(reportController)));

  router.get('/daily/export', authenticate, asyncHandler(reportController.exportDaily.bind(reportController)));
  router.get('/sales/export', authenticate, asyncHandler(reportController.exportSales.bind(reportController)));
  router.get('/finance/export', authenticate, asyncHandler(reportController.exportFinance.bind(reportController)));
  router.get('/sales-per-product/export', authenticate, asyncHandler(reportController.exportSalesPerProduct.bind(reportController)));

  return router;
}
