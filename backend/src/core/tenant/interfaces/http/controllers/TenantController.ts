import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { TenantService } from '../../../application/services/TenantService';
import { SubscriptionService } from '../../../../billing/application/services/SubscriptionService';
import { createTenantSchema, updateTenantConfigSchema } from '@posmono/shared';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { HubRepository } from '../../../../../core/hub/domain/HubRepository';

export class TenantController extends BaseController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly hubRepository?: HubRepository,
    private readonly subscriptionService?: SubscriptionService,
  ) {
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
      billingEmail: parsed.data.owner?.email ?? '',
      owner: parsed.data.owner,
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
    // Lazy enforcement: an expired-but-usable tenant becomes `suspended` here
    // instead of waiting for the next sweep, so the banner and the response
    // never disagree about the deadline.
    await this.tenantService.markSuspendedIfExpired(tenant);
    const data = tenant.serialize();

    let hubName: string | null = null;
    if (data.hubId && this.hubRepository) {
      const hub = await this.hubRepository.findById(data.hubId);
      hubName = hub?.serialize().name ?? null;
    }

    const expiresAt = data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt) : null;
    const daysRemaining = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

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
      hubId: data.hubId,
      hubName,
      config: tenant.configValue,
      modules: data.modules,
      subscriptionExpiresAt: data.subscriptionExpiresAt,
      daysRemaining: Math.max(daysRemaining, 0),
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

  async getSubscription(req: Request, res: Response): Promise<void> {
    const tenant = await this.tenantService.getById(req.tenantId);
    await this.tenantService.markSuspendedIfExpired(tenant);
    const sub = await this.tenantService.getSubscription(req.tenantId);
    this.ok(res, sub);
  }

  async renewSubscription(req: Request, res: Response): Promise<void> {
    const { days } = req.body;
    const numDays = parseInt(days, 10) || 30;
    if (this.subscriptionService) {
      // The billing path extends BOTH the tenant and the subscription document
      // (and writes the ledger). TenantService.extendSubscription alone would
      // only move `Tenant.subscriptionExpiresAt` and let the two clocks drift.
      await this.subscriptionService.extendSubscription(req.tenantId, numDays, {
        reason: 'Perpanjangan mandiri (merchant)',
      });
    } else {
      await this.tenantService.extendSubscription(req.tenantId, numDays);
    }
    const sub = await this.tenantService.getSubscription(req.tenantId);
    this.ok(res, { message: 'Subscription successfully renewed', subscription: sub });
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
