import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { PaymentMethodService } from '../../../application/services/PaymentMethodService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const createPaymentMethodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().optional(),
  requiresReference: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

const updatePaymentMethodSchema = createPaymentMethodSchema.partial();

export class PaymentMethodController extends BaseController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createPaymentMethodSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const method = await this.paymentMethodService.create({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.created(res, method.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updatePaymentMethodSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const method = await this.paymentMethodService.update(req.params.id, req.tenantId, parsed.data);
    this.ok(res, method.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const methods = await this.paymentMethodService.list(req.tenantId);
    this.ok(res, methods.map((m) => m.serialize()));
  }

  async listActive(req: Request, res: Response): Promise<void> {
    const methods = await this.paymentMethodService.listActive(req.tenantId);
    this.ok(res, methods.map((m) => m.serialize()));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const method = await this.paymentMethodService.getById(req.params.id, req.tenantId);
    this.ok(res, method.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.paymentMethodService.delete(req.params.id, req.tenantId);
    this.noContent(res);
  }
}
