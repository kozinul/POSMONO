import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { CreateOrderService } from '../../../application/services/OrderService';
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
  notes: z.string().optional().default(''),
  source: z.enum(['pos', 'waiter', 'online']).default('pos'),
  metadata: z.record(z.unknown()).optional().default({}),
});

export class OrderController extends BaseController {
  constructor(
    private readonly createOrderService: CreateOrderService,
    private readonly orderRepository: MongoOrderRepository,
  ) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const { items, customerId, ...rest } = parsed.data;
    const order = await this.createOrderService.execute({
      tenantId: req.tenantId,
      cashierId: req.userId,
      items: items.map((item) => ({ ...item, variantId: item.variantId ?? null })),
      customerId: customerId ?? null,
      ...rest,
    });

    this.created(res, order.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const { status, page, limit } = req.query;
    const result = await this.orderRepository.findByTenant(req.tenantId, {
      status: status as string,
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
}
