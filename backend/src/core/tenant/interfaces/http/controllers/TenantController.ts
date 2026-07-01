import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { TenantService } from '../../../application/services/TenantService';
import { createTenantSchema, updateTenantConfigSchema } from '@posmono/shared';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

export class TenantController extends BaseController {
  constructor(private readonly tenantService: TenantService) {
    super();
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const tenant = await this.tenantService.create({
      name: parsed.data.name,
      slug: parsed.data.slug,
      ownerId: req.userId,
      businessType: parsed.data.businessType,
      billingEmail: '',
    });

    this.created(res, {
      id: tenant.id.toValue(),
      name: tenant.serialize().name,
      slug: tenant.serialize().slug,
      businessType: tenant.serialize().businessType,
      config: tenant.configValue,
    });
  }

  async getCurrent(req: Request, res: Response): Promise<void> {
    const tenant = await this.tenantService.getById(req.tenantId);
    const data = tenant.serialize();

    this.ok(res, {
      id: data.id,
      name: data.name,
      slug: data.slug,
      businessType: data.businessType,
      businessCategory: data.businessCategory,
      address: data.address,
      phone: data.phone,
      status: data.status,
      plan: data.plan,
      config: tenant.configValue,
      modules: data.modules,
    });
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    const { name, businessCategory, address, phone } = req.body;
    const tenant = await this.tenantService.updateProfile(req.tenantId, { name, businessCategory, address, phone });
    const data = tenant.serialize();

    this.ok(res, {
      id: data.id,
      name: data.name,
      businessCategory: data.businessCategory,
      address: data.address,
      phone: data.phone,
    });
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    const parsed = updateTenantConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const tenant = await this.tenantService.updateConfig(req.tenantId, parsed.data);

    this.ok(res, {
      id: tenant.id.toValue(),
      config: tenant.configValue,
    });
  }

  async getBySlug(req: Request, res: Response): Promise<void> {
    const tenant = await this.tenantService.getBySlug(req.params.slug);
    if (!tenant) {
      this.ok(res, null);
      return;
    }

    this.ok(res, {
      id: tenant.id.toValue(),
      name: tenant.serialize().name,
      slug: tenant.serialize().slug,
      businessType: tenant.serialize().businessType,
    });
  }
}
