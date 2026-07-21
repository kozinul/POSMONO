import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { SettingService } from '../../../application/services/SettingService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const setSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  category: z.string().optional(),
  description: z.string().optional(),
});

const setManySchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1),
    value: z.unknown(),
    category: z.string().optional(),
    description: z.string().optional(),
  })).min(1),
});

export class SettingController extends BaseController {
  constructor(private readonly settingService: SettingService) {
    super();
  }

  async getAll(req: Request, res: Response): Promise<void> {
    const { category } = req.query;
    const settings = await this.settingService.getAll(req.tenantId, category as string | undefined);
    this.ok(res, settings.map((s) => s.serialize()));
  }

  async getByKey(req: Request, res: Response): Promise<void> {
    const setting = await this.settingService.get(req.tenantId, req.params.key);
    if (!setting) throw new ValidationError('Setting not found');
    this.ok(res, setting.serialize());
  }

  async set(req: Request, res: Response): Promise<void> {
    const parsed = setSettingSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const setting = await this.settingService.set({
      tenantId: req.tenantId,
      key: parsed.data.key,
      value: parsed.data.value,
      category: parsed.data.category,
      description: parsed.data.description,
    });

    this.ok(res, setting.serialize());
  }

  async setMany(req: Request, res: Response): Promise<void> {
    const parsed = setManySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const settings = await this.settingService.setMany({
      tenantId: req.tenantId,
      settings: parsed.data.settings.map((s) => ({
        key: s.key,
        value: s.value as unknown,
        category: s.category,
        description: s.description,
      })),
    });

    this.ok(res, settings.map((s) => s.serialize()));
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.settingService.delete(req.tenantId, req.params.key);
    this.ok(res, { deleted: true });
  }
}
