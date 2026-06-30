import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { InventoryService } from '../../../application/services/InventoryService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const stockInSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  variantId: z.string().nullable().optional(),
  warehouseId: z.string().optional(),
  reason: z.string().optional(),
  referenceId: z.string().optional(),
});

const stockOutSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  variantId: z.string().nullable().optional(),
  warehouseId: z.string().optional(),
  reason: z.string().optional(),
  referenceId: z.string().optional(),
});

const adjustSchema = z.object({
  productId: z.string().min(1),
  delta: z.number(),
  reason: z.string().min(1),
  variantId: z.string().nullable().optional(),
  warehouseId: z.string().optional(),
});

export class InventoryController extends BaseController {
  constructor(private readonly inventoryService: InventoryService) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    const stocks = await this.inventoryService.listStock(req.tenantId);
    this.ok(res, stocks.map((s) => ({
      ...s.serialize(),
      availableQuantity: s.availableQuantity,
    })));
  }

  async getByProduct(req: Request, res: Response): Promise<void> {
    const stock = await this.inventoryService.getStock(req.tenantId, req.params.productId);
    this.ok(res, {
      ...stock.serialize(),
      availableQuantity: stock.availableQuantity,
    });
  }

  async getLowStock(req: Request, res: Response): Promise<void> {
    const stocks = await this.inventoryService.getLowStock(req.tenantId);
    this.ok(res, stocks.map((s) => ({
      ...s.serialize(),
      availableQuantity: s.availableQuantity,
    })));
  }

  async stockIn(req: Request, res: Response): Promise<void> {
    const parsed = stockInSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const stock = await this.inventoryService.stockIn({
      tenantId: req.tenantId,
      userId: req.userId,
      ...parsed.data,
    });

    this.ok(res, stock.serialize());
  }

  async stockOut(req: Request, res: Response): Promise<void> {
    const parsed = stockOutSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const stock = await this.inventoryService.stockOut({
      tenantId: req.tenantId,
      userId: req.userId,
      ...parsed.data,
    });

    this.ok(res, stock.serialize());
  }

  async adjust(req: Request, res: Response): Promise<void> {
    const parsed = adjustSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const stock = await this.inventoryService.adjust({
      tenantId: req.tenantId,
      userId: req.userId,
      ...parsed.data,
    });

    this.ok(res, stock.serialize());
  }

  async movements(req: Request, res: Response): Promise<void> {
    const { productId, type, page, limit } = req.query;
    const filter: { productId?: string; type?: string } = {};
    if (productId) filter.productId = productId as string;
    if (type) filter.type = type as string;

    const result = await this.inventoryService.getMovements(
      req.tenantId,
      filter,
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined,
    );

    this.ok(res, result.movements, {
      total: result.total,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 50,
    });
  }
}
