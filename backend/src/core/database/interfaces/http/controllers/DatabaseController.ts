import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { DatabaseService } from '../../../application/services/DatabaseService';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { z } from 'zod';

const restoreSchema = z
  .object({
    orders: z.array(z.record(z.string(), z.any())).optional(),
    payments: z.array(z.record(z.string(), z.any())).optional(),
    refunds: z.array(z.record(z.string(), z.any())).optional(),
  })
  .refine((d) => d.orders || d.payments || d.refunds, {
    message: 'At least one collection (orders/payments/refunds) is required',
  });

const deleteSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export class DatabaseController extends BaseController {
  constructor(private readonly databaseService: DatabaseService) {
    super();
  }

  async stats(req: Request, res: Response): Promise<void> {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const result = await this.databaseService.stats(req.tenantId, from, to);
    this.ok(res, result);
  }

  async backup(req: Request, res: Response): Promise<void> {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const result = await this.databaseService.backup(req.tenantId, from, to);
    this.ok(res, result);
  }

  async restore(req: Request, res: Response): Promise<void> {
    const parsed = restoreSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid backup payload');
    }
    const result = await this.databaseService.restore(req.tenantId, parsed.data);
    this.ok(res, result);
  }

  async deleteTransactions(req: Request, res: Response): Promise<void> {
    const parsed = deleteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid delete payload');
    }
    const result = await this.databaseService.deleteTransactions(
      req.tenantId,
      parsed.data.from,
      parsed.data.to,
    );
    this.ok(res, result);
  }
}
