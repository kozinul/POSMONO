import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import {
  CreateOrderService,
  UpdateOrderService,
  VoidOrderService,
  VoidItemService,
  PayOrderService,
  VoidPaymentService,
  ReopenOrderService,
  SplitItemService,
  RemoveItemService,
  UpdateItemQuantityService,
  VoidAndRollbackService,
  TopayService,
  RefundService,
  ApplyDiscountService,
  SetServiceChargeService,
  HoldOrderService,
  RecallOrderService,
} from '../../../application/services/OrderService';
import { MongoOrderRepository } from '../../../infrastructure/persistence/MongoOrderRepository';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().nullable().optional(),
    productName: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
    totalPrice: z.number().nonnegative(),
    modifiers: z.array(z.object({ name: z.string(), price: z.number() })).optional().default([]),
    tax: z.object({ rate: z.number(), amount: z.number() }).optional().default({ rate: 0, amount: 0 }),
  })).min(1),
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  cashierName: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  source: z.enum(['pos', 'waiter', 'online']).default('pos'),
  tableNumber: z.string().nullable().optional(),
  transactionType: z.enum(['dine_in', 'takeaway', 'delivery', 'online']).optional().default('dine_in'),
  metadata: z.record(z.unknown()).optional().default({}),
});

const updateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().nullable().optional(),
    productName: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
    totalPrice: z.number().nonnegative(),
    modifiers: z.array(z.object({ name: z.string(), price: z.number() })).optional().default([]),
    tax: z.object({ rate: z.number(), amount: z.number() }).optional().default({ rate: 0, amount: 0 }),
  })).optional(),
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  cashierName: z.string().optional(),
  notes: z.string().optional(),
  tableNumber: z.string().nullable().optional(),
  transactionType: z.enum(['dine_in', 'takeaway', 'delivery', 'online']).optional(),
  metadata: z.record(z.unknown()).optional(),
}).optional();

const voidOrderSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  voidedByName: z.string().min(1, 'Voided by name is required'),
});

const voidItemSchema = z.object({
  itemIndex: z.number().int().nonnegative(),
  reason: z.string().min(1, 'Reason is required'),
  voidedByName: z.string().min(1, 'Voided by name is required'),
});

const payOrderSchema = z.object({
  paymentBreakdown: z.array(z.object({
    method: z.string().min(1),
    code: z.string().min(1),
    amount: z.number().positive(),
    change: z.number().default(0),
    cardLastFour: z.string().optional(),
  })).min(1),
  cashierName: z.string().optional().default(''),
});

const splitItemSchema = z.object({
  itemIndex: z.number().int().nonnegative(),
  quantities: z.array(z.number().int().positive()).min(2, 'At least 2 quantities required'),
});

const voidPaymentSchema = z.object({
  paymentIndex: z.number().int().nonnegative(),
  reason: z.string().min(1, 'Reason is required'),
  voidedByName: z.string().min(1, 'Voided by name is required'),
});

const removeItemSchema = z.object({
  itemIndex: z.number().int().nonnegative(),
});

const updateItemQuantitySchema = z.object({
  itemIndex: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

const voidAndRollbackSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  voidedByName: z.string().min(1, 'Voided by name is required'),
});

const topaySchema = z.object({
  paymentBreakdown: z.array(z.object({
    method: z.string().min(1),
    code: z.string().min(1),
    amount: z.number().positive(),
    change: z.number().default(0),
    cardLastFour: z.string().optional(),
  })).min(1),
  cashierName: z.string().optional().default(''),
});

const refundSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  refundedByName: z.string().min(1, 'Refunded by name is required'),
});

const applyDiscountSchema = z.object({
  discountBreakdown: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['percentage', 'nominal', 'buy_x_get_y', 'min_purchase']),
    amount: z.number().nonnegative(),
    appliedTo: z.string().min(1),
  })),
});

const setServiceChargeSchema = z.object({
  rate: z.number().min(0).max(1),
});

export class OrderController extends BaseController {
  constructor(
    private readonly createOrderService: CreateOrderService,
    private readonly updateOrderService: UpdateOrderService,
    private readonly voidOrderService: VoidOrderService,
    private readonly voidItemService: VoidItemService,
    private readonly payOrderService: PayOrderService,
    private readonly voidPaymentService: VoidPaymentService,
    private readonly reopenOrderService: ReopenOrderService,
    private readonly splitItemService: SplitItemService,
    private readonly removeItemService: RemoveItemService,
    private readonly updateItemQuantityService: UpdateItemQuantityService,
    private readonly voidAndRollbackService: VoidAndRollbackService,
    private readonly topayService: TopayService,
    private readonly refundService: RefundService,
    private readonly applyDiscountService: ApplyDiscountService,
    private readonly setServiceChargeService: SetServiceChargeService,
    private readonly holdOrderService: HoldOrderService,
    private readonly recallOrderService: RecallOrderService,
    private readonly orderRepository: MongoOrderRepository,
  ) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const { items, customerId, customerName, tableNumber, cashierName, ...rest } = parsed.data;
    const order = await this.createOrderService.execute({
      tenantId: req.tenantId,
      cashierId: req.userId,
      cashierName: cashierName ?? '',
      items: items.map((item) => ({ ...item, variantId: item.variantId ?? null })),
      customerId: customerId ?? null,
      customerName: customerName ?? null,
      tableNumber: tableNumber ?? undefined,
      ...rest,
    });

    this.created(res, order.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const data = parsed.data || {};
    const { items, tableNumber, ...rest } = data;
    const order = await this.updateOrderService.execute({
      id: req.params.id,
      tenantId: req.tenantId,
      items: items?.map((item) => ({ ...item, variantId: item.variantId ?? null })),
      tableNumber: tableNumber ?? undefined,
      ...rest,
      cashierName: rest.cashierName || '',
    });

    this.ok(res, order.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const { status, page, limit, dateFrom, dateTo } = req.query;

    const result = await this.orderRepository.findByTenant(req.tenantId, {
      status: status as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    this.ok(res, result.orders.map((o) => o.serialize()), {
      total: result.total,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 50,
    });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const order = await this.orderRepository.findById(req.params.id);
    if (!order || order.serialize().tenantId !== req.tenantId) {
      throw new ValidationError('Order not found');
    }
    this.ok(res, order.serialize());
  }

  async voidOrder(req: Request, res: Response): Promise<void> {
    const parsed = voidOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.voidOrderService.execute({
      id: req.params.id,
      voidedBy: req.userId,
      voidedByName: parsed.data.voidedByName,
      reason: parsed.data.reason,
    });

    this.ok(res, order.serialize());
  }

  async voidItem(req: Request, res: Response): Promise<void> {
    const parsed = voidItemSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.voidItemService.execute({
      id: req.params.id,
      itemIndex: parsed.data.itemIndex,
      reason: parsed.data.reason,
      voidedBy: req.userId,
      voidedByName: parsed.data.voidedByName,
    });

    this.ok(res, order.serialize());
  }

  async pay(req: Request, res: Response): Promise<void> {
    const parsed = payOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.payOrderService.execute({
      id: req.params.id,
      paymentBreakdown: parsed.data.paymentBreakdown,
      cashierId: req.userId,
      cashierName: parsed.data.cashierName,
    });

    this.ok(res, order.serialize());
  }

  async splitItem(req: Request, res: Response): Promise<void> {
    const parsed = splitItemSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.splitItemService.execute({
      orderId: req.params.id,
      itemIndex: parsed.data.itemIndex,
      quantities: parsed.data.quantities,
    });

    this.ok(res, order.serialize());
  }

  async voidPayment(req: Request, res: Response): Promise<void> {
    const parsed = voidPaymentSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.voidPaymentService.execute({
      id: req.params.id,
      paymentIndex: parsed.data.paymentIndex,
      reason: parsed.data.reason,
      voidedBy: req.userId,
      voidedByName: parsed.data.voidedByName,
    });

    this.ok(res, order.serialize());
  }

  async reopen(req: Request, res: Response): Promise<void> {
    const order = await this.reopenOrderService.execute({
      id: req.params.id,
      reopenedBy: req.userId,
    });

    this.ok(res, order.serialize());
  }

  async removeItem(req: Request, res: Response): Promise<void> {
    const parsed = removeItemSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.removeItemService.execute({
      id: req.params.id,
      itemIndex: parsed.data.itemIndex,
    });

    this.ok(res, order.serialize());
  }

  async updateItemQuantity(req: Request, res: Response): Promise<void> {
    const parsed = updateItemQuantitySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.updateItemQuantityService.execute({
      id: req.params.id,
      itemIndex: parsed.data.itemIndex,
      quantity: parsed.data.quantity,
    });

    this.ok(res, order.serialize());
  }

  async voidAndRollback(req: Request, res: Response): Promise<void> {
    const parsed = voidAndRollbackSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.voidAndRollbackService.execute({
      id: req.params.id,
      reason: parsed.data.reason,
      voidedBy: req.userId,
      voidedByName: parsed.data.voidedByName,
    });

    this.ok(res, order.serialize());
  }

  async topay(req: Request, res: Response): Promise<void> {
    const parsed = topaySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.topayService.execute({
      id: req.params.id,
      paymentBreakdown: parsed.data.paymentBreakdown,
      cashierId: req.userId,
      cashierName: parsed.data.cashierName,
    });

    this.ok(res, order.serialize());
  }

  async refund(req: Request, res: Response): Promise<void> {
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.refundService.execute({
      id: req.params.id,
      refundedBy: req.userId,
      refundedByName: parsed.data.refundedByName,
      reason: parsed.data.reason,
    });

    this.ok(res, order.serialize());
  }

  async applyDiscount(req: Request, res: Response): Promise<void> {
    const parsed = applyDiscountSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.applyDiscountService.execute({
      id: req.params.id,
      discountBreakdown: parsed.data.discountBreakdown,
    });

    this.ok(res, order.serialize());
  }

  async setServiceCharge(req: Request, res: Response): Promise<void> {
    const parsed = setServiceChargeSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const order = await this.setServiceChargeService.execute({
      id: req.params.id,
      rate: parsed.data.rate,
    });

    this.ok(res, order.serialize());
  }

  async hold(req: Request, res: Response): Promise<void> {
    const order = await this.holdOrderService.execute({
      id: req.params.id,
    });

    this.ok(res, order.serialize());
  }

  async recall(req: Request, res: Response): Promise<void> {
    const order = await this.recallOrderService.execute({
      id: req.params.id,
    });

    this.ok(res, order.serialize());
  }
}
