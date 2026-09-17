import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { ModifierService } from '../../../application/services/ModifierService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const modifierOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  priceAdjustment: z.number().optional(),
  price: z.number().optional(),
  isActive: z.boolean().optional(),
});

const createModifierSchema = z.object({
  productId: z.string().nullable().optional(),
  familyId: z.string().nullable().optional(),
  name: z.string().min(1, 'Name is required'),
  displayType: z.enum(['radio', 'checkbox', 'stepper']).optional(),
  minSelections: z.number().int().min(0).optional(),
  maxSelections: z.number().int().min(1).optional(),
  options: z.array(modifierOptionSchema).optional().default([]),
  required: z.boolean().optional(),
  isActive: z.boolean().optional(),
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
      productId: parsed.data.productId ?? null,
      familyId: parsed.data.familyId ?? null,
      displayType: parsed.data.displayType ?? 'radio',
      minSelections: parsed.data.minSelections ?? 0,
      maxSelections: parsed.data.maxSelections ?? 1,
      options: (parsed.data.options || []).map((o) => ({
        id: o.id || '',
        name: o.name,
        priceAdjustment: o.priceAdjustment ?? o.price ?? 0,
        isActive: o.isActive ?? true,
      })),
      required: parsed.data.required ?? false,
      isActive: parsed.data.isActive ?? true,
    });

    this.created(res, modifier.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateModifierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const updateData: any = { ...parsed.data };
    if (updateData.options) {
      updateData.options = updateData.options.map((o: any) => ({
        id: o.id || '',
        name: o.name,
        priceAdjustment: o.priceAdjustment ?? o.price ?? 0,
        isActive: o.isActive ?? true,
      }));
    }

    const modifier = await this.modifierService.update(req.params.id, req.tenantId, updateData);
    this.ok(res, modifier.serialize());
  }

  async list(req: Request, res: Response): Promise<void> {
    const modifiers = await this.modifierService.listByTenant(req.tenantId);
    this.ok(
      res,
      modifiers.map((m) => m.serialize()),
    );
  }

  async listGlobal(req: Request, res: Response): Promise<void> {
    const modifiers = await this.modifierService.listGlobal(req.tenantId);
    this.ok(
      res,
      modifiers.map((m) => m.serialize()),
    );
  }

  async listByProduct(req: Request, res: Response): Promise<void> {
    const modifiers = await this.modifierService.listByProductGroups(req.params.productId);
    this.ok(
      res,
      modifiers.map((m) => m.serialize()),
    );
  }

  async listByFamily(req: Request, res: Response): Promise<void> {
    const modifiers = await this.modifierService.listByFamily(req.params.familyId);
    this.ok(
      res,
      modifiers.map((m) => m.serialize()),
    );
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.modifierService.delete(req.params.id, req.tenantId);
    this.ok(res, { success: true });
  }
}
