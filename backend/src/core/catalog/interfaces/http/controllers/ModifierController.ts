import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { ModifierService } from '../../../application/services/ModifierService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const modifierOptionSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
});

const createModifierSchema = z.object({
  productId: z.string().optional(),
  familyId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  options: z.array(modifierOptionSchema).optional(),
  required: z.boolean().optional(),
});

const updateModifierSchema = createModifierSchema.partial();

export class ModifierController extends BaseController {
  constructor(private readonly modifierService: ModifierService) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createModifierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const modifier = await this.modifierService.create({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.created(res, modifier.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateModifierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const modifier = await this.modifierService.update(req.params.id, req.tenantId, parsed.data);
    this.ok(res, modifier.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const modifiers = await this.modifierService.list(req.tenantId);
    this.ok(res, modifiers.map((m) => m.serialize()));
  }

  async listByProduct(req: Request, res: Response): Promise<void> {
    const modifiers = await this.modifierService.listByProduct(req.params.productId);
    this.ok(res, modifiers.map((m) => m.serialize()));
  }

  async listByFamily(req: Request, res: Response): Promise<void> {
    const modifiers = await this.modifierService.listByFamily(req.params.familyId);
    this.ok(res, modifiers.map((m) => m.serialize()));
  }

  async listGlobal(req: Request, res: Response): Promise<void> {
    const modifiers = await this.modifierService.listGlobal(req.tenantId);
    this.ok(res, modifiers.map((m) => m.serialize()));
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.modifierService.delete(req.params.id, req.tenantId);
    this.noContent(res);
  }
}
