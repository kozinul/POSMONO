import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { MenuTypeService } from '../../../application/services/MenuTypeService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const createMenuTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sortOrder: z.number().optional(),
});

const updateMenuTypeSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

const renameMenuTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export class MenuTypeController extends BaseController {
  constructor(private readonly menuTypeService: MenuTypeService) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createMenuTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const menuType = await this.menuTypeService.create({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.created(res, menuType.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const menuTypes = await this.menuTypeService.list(req.tenantId);
    this.ok(res, menuTypes.map((m) => m.serialize()));
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateMenuTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const menuType = await this.menuTypeService.update(req.params.id, req.tenantId, parsed.data);
    this.ok(res, menuType.serialize());
  }

  async rename(req: Request, res: Response): Promise<void> {
    const parsed = renameMenuTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const menuType = await this.menuTypeService.rename(req.params.id, req.tenantId, parsed.data.name);
    this.ok(res, menuType.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.menuTypeService.delete(req.params.id, req.tenantId);
    this.noContent(res);
  }
}
