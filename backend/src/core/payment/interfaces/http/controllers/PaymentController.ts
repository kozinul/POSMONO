import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { PaymentService } from '../../../application/services/PaymentService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const payCashSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive(),
});

export class PaymentController extends BaseController {
  constructor(private readonly paymentService: PaymentService) {
    super();
  }

  async payCash(req: Request, res: Response): Promise<void> {
    const parsed = payCashSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const result = await this.paymentService.payCash({
      tenantId: req.tenantId,
      cashierId: req.userId,
      ...parsed.data,
    });

    const paymentData = result.payment.serialize();
    const orderData = result.order.serialize();
    this.ok(res, {
      payment: { ...paymentData, change: paymentData.amount - orderData.total },
      order: orderData,
    });
  }

  async getByOrder(req: Request, res: Response): Promise<void> {
    const payment = await this.paymentService.getByOrder(req.tenantId, req.params.orderId);
    if (!payment) throw new ValidationError('Payment not found');
    this.ok(res, payment.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const payments = await this.paymentService.list(req.tenantId);
    this.ok(res, payments.map((p) => p.serialize()));
  }
}
