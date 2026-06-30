import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { CategoryService } from '../../../application/services/CategoryService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  parentId: z.string().optional(),
  sortOrder: z.number().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

export class CategoryController extends BaseController {
  constructor(private readonly categoryService: CategoryService) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const category = await this.categoryService.create({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.created(res, category.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const category = await this.categoryService.update(req.params.id, req.tenantId, parsed.data);
    this.ok(res, category.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const categories = await this.categoryService.list(req.tenantId);
    this.ok(res, categories.map((c) => c.serialize()));
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.categoryService.delete(req.params.id, req.tenantId);
    this.noContent(res);
  }
}
