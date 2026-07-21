import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { PromotionService } from '../../../application/services/PromotionService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const ruleSchema = z.object({
  type: z.enum([
    'min_purchase', 'min_items', 'buy_x_get_y', 'percentage_off', 'nominal_off',
    'fixed_price', 'free_item', 'bundle_price', 'product_match', 'category_match',
    'day_of_week', 'date_range', 'time_range', 'customer_tag',
  ]),
  params: z.record(z.unknown()),
});

const effectSchema = z.object({
  type: z.enum(['percentage', 'nominal', 'fixed_price', 'free_item', 'bundle_price']),
  value: z.number(),
  target: z.enum(['order', 'item', 'cheapest_item', 'specific_product']).default('order'),
  targetProductId: z.string().optional(),
  maxDiscount: z.number().optional(),
});

const createPromotionSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional().default(''),
  priority: z.number().optional().default(0),
  exclusive: z.boolean().optional().default(false),
  stackable: z.boolean().optional().default(false),
  ruleLogic: z.enum(['AND', 'OR']).optional().default('AND'),
  rules: z.array(ruleSchema).default([]),
  effects: z.array(effectSchema).min(1, 'At least one effect is required'),
  usageLimit: z.number().nullable().optional(),
  minPurchase: z.number().optional().default(0),
  isActive: z.boolean().optional().default(true),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

const updatePromotionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.number().optional(),
  exclusive: z.boolean().optional(),
  stackable: z.boolean().optional(),
  ruleLogic: z.enum(['AND', 'OR']).optional(),
  rules: z.array(ruleSchema).optional(),
  effects: z.array(effectSchema).optional(),
  usageLimit: z.number().nullable().optional(),
  minPurchase: z.number().optional(),
  isActive: z.boolean().optional(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const validatePromotionSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number(),
  itemCount: z.number(),
  productIds: z.array(z.string()).default([]),
  categoryIds: z.array(z.string()).default([]),
  customerTags: z.array(z.string()).default([]),
});

const applyPromotionSchema = z.object({
  promotionId: z.string().min(1),
  subtotal: z.number(),
  items: z.array(z.object({
    productId: z.string(),
    categoryId: z.string(),
    unitPrice: z.number(),
    quantity: z.number(),
  })),
});

export class PromotionController extends BaseController {
  constructor(private readonly promotionService: PromotionService) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createPromotionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input: ' + JSON.stringify(parsed.error.flatten().fieldErrors));

    const promotion = await this.promotionService.create({
      tenantId: req.tenantId,
      ...parsed.data,
      validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
    });

    this.created(res, promotion.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updatePromotionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const promotion = await this.promotionService.update({
      id: req.params.id,
      tenantId: req.tenantId,
      ...parsed.data,
      validFrom: parsed.data.validFrom !== undefined ? (parsed.data.validFrom ? new Date(parsed.data.validFrom) : null) : undefined,
      validUntil: parsed.data.validUntil !== undefined ? (parsed.data.validUntil ? new Date(parsed.data.validUntil) : null) : undefined,
    });

    this.ok(res, promotion.serialize());
  }

  async getById(req: Request, res: Response): Promise<void> {
    const promotion = await this.promotionService.getById(req.tenantId, req.params.id);
    if (!promotion) throw new ValidationError('Promotion not found');
    this.ok(res, promotion.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const { page, limit, isActive } = req.query;
    const result = await this.promotionService.list(req.tenantId, {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });

    this.ok(res, result.promotions.map((p) => p.serialize()), {
      total: result.total,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 50,
    });
  }

  async validate(req: Request, res: Response): Promise<void> {
    const parsed = validatePromotionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const result = await this.promotionService.validate({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.ok(res, {
      valid: result.valid,
      promotion: result.promotion?.serialize(),
      error: result.error,
    });
  }

  async apply(req: Request, res: Response): Promise<void> {
    const parsed = applyPromotionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const result = await this.promotionService.apply({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.ok(res, result);
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.promotionService.delete(req.tenantId, req.params.id);
    this.ok(res, { deleted: true });
  }
}
