import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { FamilyService } from '../../../application/services/FamilyService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const createFamilySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
});

const updateFamilySchema = createFamilySchema.partial();

export class FamilyController extends BaseController {
  constructor(private readonly familyService: FamilyService) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createFamilySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const family = await this.familyService.create({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.created(res, family.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateFamilySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const family = await this.familyService.update(req.params.id, req.tenantId, parsed.data);
    this.ok(res, family.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const families = await this.familyService.list(req.tenantId);
    this.ok(res, families.map((f) => f.serialize()));
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.familyService.delete(req.params.id, req.tenantId);
    this.noContent(res);
  }
}
