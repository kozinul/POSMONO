import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { ProductService } from '../../../application/services/ProductService';
import { createProductSchema, updateProductSchema } from '@posmono/shared';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

export class ProductController extends BaseController {
  constructor(private readonly productService: ProductService) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const product = await this.productService.create({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.created(res, product.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const product = await this.productService.update(req.params.id, req.tenantId, parsed.data);
    this.ok(res, product.serialize());
  }

  async getById(req: Request, res: Response): Promise<void> {
    const product = await this.productService.getById(req.params.id, req.tenantId);
    this.ok(res, product.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const { page, limit, categoryId, search } = req.query;
    const result = await this.productService.list(req.tenantId, {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      categoryId: categoryId as string,
      search: search as string,
    });

    this.ok(res, result.products.map((p) => p.serialize()), {
      total: result.total,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 50,
    });
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.productService.delete(req.params.id, req.tenantId);
    this.noContent(res);
  }
}
