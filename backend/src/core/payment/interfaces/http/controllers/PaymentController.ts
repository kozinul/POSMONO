import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { PaymentService } from '../../../application/services/PaymentService';
import { QrisGatewayService } from '../../../application/services/QrisGatewayService';
import { ReceiptRenderResult } from '../../../../../core/template/application/services/ReceiptRenderService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { logger } from '../../../../../@shared/infrastructure/logger/Logger';

function serializeReceipt(receipt: ReceiptRenderResult | null | undefined): Record<string, unknown> | null {
  if (!receipt) return null;
  return {
    layout: receipt.layout,
    thermal: receipt.thermal.toString('base64'),
    pdf: receipt.pdf.toString('base64'),
    templateId: receipt.templateId,
    templateName: receipt.templateName,
    paper: receipt.paper,
  };
}

const payCashSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    productName: z.string().optional().default(''),
    categoryId: z.string().optional().default(''),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
    pricingMode: z.enum(['inclusive', 'exclusive']).optional().nullable(),
    isFreeItem: z.boolean().optional(),
  })).min(1),
  amountPaid: z.number().positive(),
  method: z.enum(['cash', 'qris', 'transfer', 'card', 'debit', 'credit', 'ewallet']).default('cash'),
  discount: z.number().nonnegative().default(0),
  discountType: z.enum(['percentage', 'nominal']).optional(),
  promoCode: z.string().optional(),
  referenceNumber: z.string().optional(),
  cardLastFour: z.string().optional(),
  splitIndex: z.number().int().positive().optional(),
  splitBaseOrderNumber: z.string().optional(),
  shiftId: z.string().optional().nullable(),
  cashierName: z.string().optional().default(''),
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
  shiftId: z.string().optional().nullable(),
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
  shiftId: z.string().optional().nullable(),
});

const qrisInitiateSchema = z.object({
  amount: z.number().int('Nominal harus bilangan bulat').positive('Nominal harus lebih dari 0'),
});

const qrisConfirmSchema = z.object({
  referenceNumber: z.string().min(1, 'Nomor referensi QRIS wajib diisi'),
  amount: z.number().int('Nominal harus bilangan bulat').positive('Nominal harus lebih dari 0'),
  orderId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    productName: z.string().optional().default(''),
    categoryId: z.string().optional().default(''),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
    pricingMode: z.enum(['inclusive', 'exclusive']).optional().nullable(),
    isFreeItem: z.boolean().optional(),
  })).optional(),
  discount: z.number().nonnegative().default(0),
  discountType: z.enum(['percentage', 'nominal']).optional(),
  promoCode: z.string().optional(),
  cashierName: z.string().optional().default(''),
  shiftId: z.string().optional().nullable(),
}).refine((d) => d.orderId || (d.items && d.items.length > 0), {
  message: 'orderId atau items wajib diisi',
});

export class PaymentController extends BaseController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly qrisGatewayService?: QrisGatewayService,
  ) {
    super();
  }

  async payCash(req: Request, res: Response): Promise<void> {
    const parsed = payCashSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const result = await this.paymentService.payCash({
      tenantId: req.tenantId,
      cashierId: req.userId,
      items: parsed.data.items.map((item) => ({
        ...item,
        pricingMode: item.pricingMode ?? undefined,
      })),
      amountPaid: parsed.data.amountPaid,
      method: parsed.data.method,
      discount: parsed.data.discount,
      discountType: parsed.data.discountType,
      promoCode: parsed.data.promoCode,
      referenceNumber: parsed.data.referenceNumber,
      cardLastFour: parsed.data.cardLastFour,
      splitIndex: parsed.data.splitIndex,
      splitBaseOrderNumber: parsed.data.splitBaseOrderNumber,
      shiftId: parsed.data.shiftId,
      cashierName: parsed.data.cashierName,
    });

    const paymentData = result.payment.serialize();
    const orderData = result.order.serialize();
    this.ok(res, {
      payment: {
        ...paymentData,
        change: paymentData.method === 'cash'
          ? paymentData.amount - (orderData.roundedPayable || orderData.total)
          : 0,
      },
      order: orderData,
      receipt: serializeReceipt(result.receipt),
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
      shiftId: parsed.data.shiftId,
    });

    this.ok(res, {
      payment: result.payment.serialize(),
      order: result.order.serialize(),
      receipt: serializeReceipt(result.receipt),
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
      order: result.order ? result.order.serialize() : null,
    });
  }

  async listRefundable(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo } = req.query;
    const result = await this.paymentService.listRefundable(
      req.tenantId,
      dateFrom ? (dateFrom as string) : undefined,
      dateTo ? (dateTo as string) : undefined,
    );
    this.ok(res, result);
  }

  async splitBill(req: Request, res: Response): Promise<void> {
    const parsed = splitBillSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const result = await this.paymentService.splitBill({
      tenantId: req.tenantId,
      orderId: parsed.data.orderId,
      splitBills: parsed.data.splitBills,
      cashierId: req.userId,
      shiftId: parsed.data.shiftId,
    });

    this.ok(res, {
      payments: result.payments.map((p, i) => ({
        ...p.serialize(),
        receipt: serializeReceipt(result.receipts[i]),
      })),
      order: result.order.serialize(),
    });
  }

  async listPendingTransfers(req: Request, res: Response): Promise<void> {
    const result = await this.paymentService.listPendingTransfers(req.tenantId);
    this.ok(res, result);
  }

  async confirmTransfer(req: Request, res: Response): Promise<void> {
    const parsed = z.object({ cashierName: z.string().optional().default('') }).safeParse(req.body ?? {});
    if (!parsed.success) throw new ValidationError('Invalid input');

    const result = await this.paymentService.confirmTransferPayment({
      tenantId: req.tenantId,
      paymentId: req.params.paymentId,
      cashierId: req.userId,
      cashierName: parsed.data.cashierName,
    });

    this.ok(res, {
      payment: result.payment.serialize(),
      order: result.order.serialize(),
      receipt: serializeReceipt(result.receipt),
    });
  }

  async cancelTransfer(req: Request, res: Response): Promise<void> {
    const parsed = z.object({ reason: z.string().optional().default('') }).safeParse(req.body ?? {});
    if (!parsed.success) throw new ValidationError('Invalid input');

    const result = await this.paymentService.cancelTransferPayment({
      tenantId: req.tenantId,
      paymentId: req.params.paymentId,
      reason: parsed.data.reason,
    });

    this.ok(res, {
      payment: result.payment.serialize(),
      order: result.order ? result.order.serialize() : null,
      orderCancelled: result.orderCancelled,
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

  private requireQrisGateway(): QrisGatewayService {
    if (!this.qrisGatewayService) throw new ValidationError('Layanan QRIS Gateway tidak tersedia');
    return this.qrisGatewayService;
  }

  async qrisInitiate(req: Request, res: Response): Promise<void> {
    const parsed = qrisInitiateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
    }
    logger.info({ tenantId: req.tenantId, amount: parsed.data.amount }, '[QRIS] POST /qris/initiate');
    const result = await this.requireQrisGateway().createInvoice(req.tenantId, parsed.data.amount);
    logger.info({ tenantId: req.tenantId, referenceNumber: result.referenceNumber, qrImageProvided: result.qrImage !== null, qrStringLength: result.qrString.length }, '[QRIS] POST /qris/initiate — success');
    this.ok(res, result);
  }

  async qrisStatus(req: Request, res: Response): Promise<void> {
    const ref = req.params.referenceNumber ?? '';
    logger.info({ tenantId: req.tenantId, referenceNumber: ref }, '[QRIS] GET /qris/status/:ref');
    const result = await this.requireQrisGateway().checkStatus(req.tenantId, ref);
    logger.info({ tenantId: req.tenantId, referenceNumber: ref, status: result.status }, '[QRIS] GET /qris/status/:ref — result');
    this.ok(res, result);
  }

  async qrisCancel(req: Request, res: Response): Promise<void> {
    const ref = req.params.referenceNumber ?? '';
    logger.info({ tenantId: req.tenantId, referenceNumber: ref }, '[QRIS] POST /qris/:ref/cancel');
    const result = await this.requireQrisGateway().cancelInvoice(req.tenantId, ref);
    logger.info({ tenantId: req.tenantId, referenceNumber: ref }, '[QRIS] POST /qris/:ref/cancel — success');
    this.ok(res, result);
  }

  async qrisTestConfig(req: Request, res: Response): Promise<void> {
    logger.info({ tenantId: req.tenantId }, '[QRIS] POST /qris/test-config');
    const result = await this.requireQrisGateway().testConnection(req.tenantId);
    logger.info({ tenantId: req.tenantId, ok: result.ok }, '[QRIS] POST /qris/test-config — result');
    this.ok(res, result);
  }

  async qrisConfirm(req: Request, res: Response): Promise<void> {
    const parsed = qrisConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));
    }

    logger.info({ tenantId: req.tenantId, referenceNumber: parsed.data.referenceNumber, amount: parsed.data.amount, orderId: parsed.data.orderId }, '[QRIS] POST /qris/confirm');
    const result = await this.paymentService.confirmQrisPayment({
      tenantId: req.tenantId,
      cashierId: req.userId,
      referenceNumber: parsed.data.referenceNumber,
      amount: parsed.data.amount,
      orderId: parsed.data.orderId,
      items: parsed.data.items?.map((item) => ({
        ...item,
        pricingMode: item.pricingMode ?? undefined,
      })),
      discount: parsed.data.discount,
      discountType: parsed.data.discountType,
      promoCode: parsed.data.promoCode,
      cashierName: parsed.data.cashierName,
      shiftId: parsed.data.shiftId,
    });

    const orderData = result.order.serialize();
    logger.info({ tenantId: req.tenantId, referenceNumber: parsed.data.referenceNumber, orderId: orderData.id, paymentId: result.payment.serialize().id }, '[QRIS] POST /qris/confirm — success');
    this.ok(res, {
      payment: result.payment.serialize(),
      order: orderData,
      receipt: serializeReceipt(result.receipt),
    });
  }
}
