import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { ShiftService } from '../../../application/services/ShiftService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const openSchema = z.object({
  registerId: z.string().min(1),
  openingBalance: z.number().nonnegative().default(0),
});

const closeSchema = z.object({
  expectedTotal: z.number().nonnegative(),
  actualTotal: z.number().nonnegative(),
});

export class ShiftController extends BaseController {
  constructor(private readonly shiftService: ShiftService) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    const shifts = await this.shiftService.list(req.tenantId);
    this.ok(res, shifts.map((s) => s.serialize()));
  }

  async getCurrent(req: Request, res: Response): Promise<void> {
    const shift = await this.shiftService.getCurrent(req.tenantId, req.userId);
    if (!shift) {
      this.ok(res, null);
      return;
    }
    this.ok(res, shift.serialize());
  }

  async open(req: Request, res: Response): Promise<void> {
    const parsed = openSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const shift = await this.shiftService.open({
      tenantId: req.tenantId,
      cashierId: req.userId,
      ...parsed.data,
    });

    this.created(res, shift.serialize());
  }

  async close(req: Request, res: Response): Promise<void> {
    const parsed = closeSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const shift = await this.shiftService.close(req.tenantId, req.params.id, parsed.data);
    this.ok(res, shift.serialize());
  }
}
