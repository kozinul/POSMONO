import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { WarehouseService } from '../../../application/services/WarehouseService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

export class WarehouseController extends BaseController {
  constructor(private readonly warehouseService: WarehouseService) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    const warehouses = await this.warehouseService.list(req.tenantId);
    this.ok(res, warehouses.map((w) => w.serialize()));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const warehouse = await this.warehouseService.getById(req.tenantId, req.params.id);
    this.ok(res, warehouse.serialize());
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const warehouse = await this.warehouseService.create({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.created(res, warehouse.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const warehouse = await this.warehouseService.update(req.tenantId, req.params.id, parsed.data);
    this.ok(res, warehouse.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.warehouseService.delete(req.tenantId, req.params.id);
    this.noContent(res);
  }
}
