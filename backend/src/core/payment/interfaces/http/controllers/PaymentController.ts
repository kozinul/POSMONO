import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { PaymentService } from '../../../application/services/PaymentService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const payCashSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
  amountPaid: z.number().positive(),
  method: z.enum(['cash', 'qris', 'transfer', 'card', 'debit', 'credit', 'ewallet']).default('cash'),
  discount: z.number().nonnegative().default(0),
  discountType: z.enum(['percentage', 'nominal']).optional(),
  promoCode: z.string().optional(),
  referenceNumber: z.string().optional(),
  cardLastFour: z.string().optional(),
});

const processPaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(['cash', 'qris', 'transfer', 'card', 'debit', 'credit', 'ewallet']),
  cardLastFour: z.string().optional(),
  provider: z.string().optional(),
  qrCodeUrl: z.string().optional(),
  paymentTransactionId: z.string().optional(),
  cashierName: z.string().optional().default(''),
});

const refundSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  refundedByName: z.string().min(1, 'Refunded by name is required'),
});

const splitBillSchema = z.object({
  orderId: z.string().min(1),
  splitBills: z.array(z.object({
    portion: z.number().int().positive(),
    amount: z.number().positive(),
    method: z.enum(['cash', 'qris', 'transfer', 'card', 'debit', 'credit', 'ewallet']),
    referenceNumber: z.string().optional().default(''),
  })).min(2, 'At least 2 split portions required'),
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
      items: parsed.data.items,
      amountPaid: parsed.data.amountPaid,
      method: parsed.data.method,
      discount: parsed.data.discount,
      discountType: parsed.data.discountType,
      promoCode: parsed.data.promoCode,
      referenceNumber: parsed.data.referenceNumber,
      cardLastFour: parsed.data.cardLastFour,
    });

    const paymentData = result.payment.serialize();
    const orderData = result.order.serialize();
    this.ok(res, {
      payment: {
        ...paymentData,
        change: paymentData.method === 'cash'
          ? paymentData.amount - orderData.total
          : 0,
      },
      order: orderData,
    });
  }

  async processPayment(req: Request, res: Response): Promise<void> {
    const parsed = processPaymentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const result = await this.paymentService.processByOrderId({
      tenantId: req.tenantId,
      orderId: parsed.data.orderId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      cashierId: req.userId,
      cashierName: parsed.data.cashierName,
      cardLastFour: parsed.data.cardLastFour,
      provider: parsed.data.provider,
      qrCodeUrl: parsed.data.qrCodeUrl,
      paymentTransactionId: parsed.data.paymentTransactionId,
    });

    this.ok(res, {
      payment: result.payment.serialize(),
      order: result.order.serialize(),
    });
  }

  async refund(req: Request, res: Response): Promise<void> {
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const result = await this.paymentService.refund({
      tenantId: req.tenantId,
      paymentId: req.params.id,
      reason: parsed.data.reason,
      refundedBy: req.userId,
      refundedByName: parsed.data.refundedByName,
    });

    this.ok(res, {
      refund: result.refund.serialize(),
      payment: result.payment.serialize(),
    });
  }

  async splitBill(req: Request, res: Response): Promise<void> {
    const parsed = splitBillSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const result = await this.paymentService.splitBill({
      tenantId: req.tenantId,
      orderId: parsed.data.orderId,
      splitBills: parsed.data.splitBills,
      cashierId: req.userId,
    });

    this.ok(res, {
      payments: result.payments.map((p) => p.serialize()),
      order: result.order.serialize(),
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
