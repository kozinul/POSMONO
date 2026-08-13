import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { PrinterService } from '../../../application/services/PrinterService';
import { PrintService } from '../../../application/services/PrintService';
import { DocumentPrintService } from '../../../application/services/DocumentPrintService';
import { createPrinterSchema, updatePrinterSchema } from '@posmono/shared';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { z } from 'zod';

const printReceiptSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().optional(),
  printerId: z.string().optional(),
});

const printKotSchema = z.object({
  printerId: z.string().optional(),
});

export class PrinterController extends BaseController {
  constructor(
    private readonly printerService: PrinterService,
    private readonly printService: PrintService,
    private readonly documentPrintService?: DocumentPrintService,
  ) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    const printers = await this.printerService.list(req.tenantId);
    this.ok(res, printers.map((p) => p.serialize()));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const printer = await this.printerService.getById(req.params.id, req.tenantId);
    this.ok(res, printer.serialize());
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createPrinterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid printer input');
    }
    const printer = await this.printerService.create(req.tenantId, parsed.data);
    this.created(res, printer.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updatePrinterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid printer input');
    }
    const printer = await this.printerService.update(req.params.id, req.tenantId, parsed.data);
    this.ok(res, printer.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.printerService.delete(req.params.id, req.tenantId);
    this.noContent(res);
  }

  async test(req: Request, res: Response): Promise<void> {
    const result = await this.printService.printTest({
      tenantId: req.tenantId,
      printerId: req.params.id || undefined,
    });
    this.ok(res, result);
  }

  async printReceipt(req: Request, res: Response): Promise<void> {
    if (!this.documentPrintService) throw new ValidationError('Print service unavailable');
    const parsed = printReceiptSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid print input');

    const result = await this.documentPrintService.printReceipt({
      tenantId: req.tenantId,
      ...parsed.data,
    });
    this.ok(res, result);
  }

  async printKot(req: Request, res: Response): Promise<void> {
    if (!this.documentPrintService) throw new ValidationError('Print service unavailable');
    const parsed = printKotSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid print input');

    const result = await this.documentPrintService.printKot({
      tenantId: req.tenantId,
      orderId: req.params.orderId,
      ...parsed.data,
    });
    this.ok(res, result);
  }
}
