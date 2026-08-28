import { Request, Response } from 'express';
import { ReportService } from '../../../application/services/ReportService';
import { ReportExportService, ReportExportFormat, ReportFile } from '../../../application/services/ReportExportService';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';

export class ReportController extends BaseController {
  constructor(
    private readonly reportService: ReportService,
    private readonly reportExportService: ReportExportService,
  ) {
    super();
  }

  private resolveFormat(format: unknown): ReportExportFormat | null {
    return format === 'pdf' || format === 'xlsx' ? format : null;
  }

  private sendFile(res: Response, file: ReportFile): void {
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  async dashboard(req: Request, res: Response): Promise<void> {
    const result = await this.reportService.getDashboardSummary(req.tenantId, req.userId);
    this.ok(res, result);
  }

  async daily(req: Request, res: Response): Promise<void> {
    const { date } = req.query;
    if (!date) {
      res.status(400).json({ success: false, message: 'date query parameter is required' });
      return;
    }
    const result = await this.reportService.getDailyReport(req.tenantId, date as string);
    this.ok(res, result);
  }

  async sales(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const result = await this.reportService.getSalesReport(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
    );
    this.ok(res, result);
  }

  async cashier(req: Request, res: Response): Promise<void> {
    const { date } = req.query;
    if (!date) {
      res.status(400).json({ success: false, message: 'date query parameter is required' });
      return;
    }
    const result = await this.reportService.getCashierReport(req.tenantId, date as string);
    this.ok(res, result);
  }

  async cashierReceipts(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const result = await this.reportService.getCashierReceiptsReport(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
    );
    this.ok(res, result);
  }

  async salesPerCashier(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const result = await this.reportService.getSalesPerCashierReport(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
    );
    this.ok(res, result);
  }

  async shiftReport(req: Request, res: Response): Promise<void> {
    const { shiftId } = req.query;
    if (!shiftId) {
      res.status(400).json({ success: false, message: 'shiftId query parameter is required' });
      return;
    }
    const result = await this.reportService.getShiftReport(req.tenantId, shiftId as string);
    this.ok(res, result);
  }

  async generateDailyMetric(req: Request, res: Response): Promise<void> {
    const { date } = req.query;
    if (!date) {
      res.status(400).json({ success: false, message: 'date query parameter is required' });
      return;
    }
    const result = await this.reportService.generateDailyMetric(req.tenantId, date as string);
    this.ok(res, result.serialize());
  }

  async dailyMetrics(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const result = await this.reportService.getDailyMetrics(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
    );
    this.ok(res, result.map((m) => m.serialize()));
  }

  async salesPerProduct(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const result = await this.reportService.getSalesPerProduct(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
    );
    this.ok(res, result);
  }

  async bestSellers(req: Request, res: Response): Promise<void> {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const result = await this.reportService.getBestSellers(req.tenantId, Number.isFinite(days) ? days : 7);
    this.ok(res, result);
  }

  async topProductsPerFamily(req: Request, res: Response): Promise<void> {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const result = await this.reportService.getTopProductsPerFamily(
      req.tenantId,
      Number.isFinite(days) ? days : 7,
      Number.isFinite(limit) ? limit : 5,
    );
    this.ok(res, result);
  }

  async activeCashiers(req: Request, res: Response): Promise<void> {
    const result = await this.reportService.getActiveCashiers(req.tenantId);
    this.ok(res, result);
  }

  async finance(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const result = await this.reportService.getFinanceReport(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
    );
    this.ok(res, result);
  }

  async exportDaily(req: Request, res: Response): Promise<void> {
    const { date, format } = req.query;
    if (!date) {
      res.status(400).json({ success: false, message: 'date query parameter is required' });
      return;
    }
    const f = this.resolveFormat(format);
    if (!f) {
      res.status(400).json({ success: false, message: 'format must be pdf or xlsx' });
      return;
    }
    const file = await this.reportExportService.exportDaily(req.tenantId, date as string, f);
    this.sendFile(res, file);
  }

  async exportSales(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, format } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const f = this.resolveFormat(format);
    if (!f) {
      res.status(400).json({ success: false, message: 'format must be pdf or xlsx' });
      return;
    }
    const file = await this.reportExportService.exportSales(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
      f,
    );
    this.sendFile(res, file);
  }

  async exportFinance(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, format } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const f = this.resolveFormat(format);
    if (!f) {
      res.status(400).json({ success: false, message: 'format must be pdf or xlsx' });
      return;
    }
    const file = await this.reportExportService.exportFinance(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
      f,
    );
    this.sendFile(res, file);
  }

  async exportSalesPerProduct(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, format } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const f = this.resolveFormat(format);
    if (!f) {
      res.status(400).json({ success: false, message: 'format must be pdf or xlsx' });
      return;
    }
    const file = await this.reportExportService.exportSalesPerProduct(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
      f,
    );
    this.sendFile(res, file);
  }

  async exportCashierReceipts(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, format } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const f = this.resolveFormat(format);
    if (!f) {
      res.status(400).json({ success: false, message: 'format must be pdf or xlsx' });
      return;
    }
    const file = await this.reportExportService.exportCashierReceipts(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
      f,
    );
    this.sendFile(res, file);
  }

  async exportSalesPerCashier(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, format } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const f = this.resolveFormat(format);
    if (!f) {
      res.status(400).json({ success: false, message: 'format must be pdf or xlsx' });
      return;
    }
    const file = await this.reportExportService.exportSalesPerCashier(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
      f,
    );
    this.sendFile(res, file);
  }

  async refunds(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const result = await this.reportService.getRefundReport(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
    );
    this.ok(res, result);
  }

  async exportRefunds(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, format } = req.query;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'dateFrom and dateTo query parameters are required' });
      return;
    }
    const f = this.resolveFormat(format);
    if (!f) {
      res.status(400).json({ success: false, message: 'format must be pdf or xlsx' });
      return;
    }
    const file = await this.reportExportService.exportRefunds(
      req.tenantId,
      dateFrom as string,
      dateTo as string,
      f,
    );
    this.sendFile(res, file);
  }

  async refundReceipt(req: Request, res: Response): Promise<void> {
    const buffer = await this.reportExportService.refundReceiptPdf(req.tenantId, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="struk-refund-${req.params.id}.pdf"`);
    res.send(buffer);
  }
}
