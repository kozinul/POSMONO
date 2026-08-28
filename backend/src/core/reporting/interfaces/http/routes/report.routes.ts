import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { ReportController } from '../controllers/ReportController';

export function createReportRoutes(reportController: ReportController): Router {
  const router = Router();

  router.get('/dashboard', authenticate, authorize('reports:read'), asyncHandler(reportController.dashboard.bind(reportController)));
  router.get('/daily', authenticate, authorize('reports:read'), asyncHandler(reportController.daily.bind(reportController)));
  router.get('/sales', authenticate, authorize('reports:read'), asyncHandler(reportController.sales.bind(reportController)));
  router.get('/cashier', authenticate, authorize('reports:read'), asyncHandler(reportController.cashier.bind(reportController)));
  router.get('/cashier-receipts', authenticate, authorize('reports:read'), asyncHandler(reportController.cashierReceipts.bind(reportController)));
  router.get('/sales-per-cashier', authenticate, authorize('reports:read'), asyncHandler(reportController.salesPerCashier.bind(reportController)));
  router.get('/shift', authenticate, asyncHandler(reportController.shiftReport.bind(reportController)));
  router.get('/daily-metrics', authenticate, authorize('reports:read'), asyncHandler(reportController.dailyMetrics.bind(reportController)));
  router.get('/sales-per-product', authenticate, authorize('reports:read'), asyncHandler(reportController.salesPerProduct.bind(reportController)));
  router.get('/best-sellers', authenticate, asyncHandler(reportController.bestSellers.bind(reportController)));
  router.get('/top-products-per-family', authenticate, asyncHandler(reportController.topProductsPerFamily.bind(reportController)));
  router.get('/active-cashiers', authenticate, asyncHandler(reportController.activeCashiers.bind(reportController)));
  router.get('/finance', authenticate, authorize('reports:read'), asyncHandler(reportController.finance.bind(reportController)));
  router.get('/inventory-summary', authenticate, authorize('reports:read'), asyncHandler(reportController.inventorySummary.bind(reportController)));
  router.get('/refunds', authenticate, authorize('reports:read'), asyncHandler(reportController.refunds.bind(reportController)));
  router.get('/refunds/:id/receipt.pdf', authenticate, authorize('reports:read'), asyncHandler(reportController.refundReceipt.bind(reportController)));
  router.post('/daily-metrics/generate', authenticate, authorize('reports:read'), asyncHandler(reportController.generateDailyMetric.bind(reportController)));

  router.get('/daily/export', authenticate, authorize('reports:read'), asyncHandler(reportController.exportDaily.bind(reportController)));
  router.get('/sales/export', authenticate, authorize('reports:read'), asyncHandler(reportController.exportSales.bind(reportController)));
  router.get('/finance/export', authenticate, authorize('reports:read'), asyncHandler(reportController.exportFinance.bind(reportController)));
  router.get('/inventory-summary/export', authenticate, authorize('reports:read'), asyncHandler(reportController.exportInventorySummary.bind(reportController)));
  router.get('/sales-per-product/export', authenticate, authorize('reports:read'), asyncHandler(reportController.exportSalesPerProduct.bind(reportController)));
  router.get('/cashier-receipts/export', authenticate, authorize('reports:read'), asyncHandler(reportController.exportCashierReceipts.bind(reportController)));
  router.get('/sales-per-cashier/export', authenticate, authorize('reports:read'), asyncHandler(reportController.exportSalesPerCashier.bind(reportController)));
  router.get('/refunds/export', authenticate, authorize('reports:read'), asyncHandler(reportController.exportRefunds.bind(reportController)));

  return router;
}
