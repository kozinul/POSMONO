import { Request, Response } from 'express';
import { ReportService } from '../../../application/services/ReportService';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';

export class ReportController extends BaseController {
  constructor(private readonly reportService: ReportService) {
    super();
  }

  async dashboard(req: Request, res: Response): Promise<void> {
    const result = await this.reportService.getDashboardSummary(req.tenantId);
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
}
