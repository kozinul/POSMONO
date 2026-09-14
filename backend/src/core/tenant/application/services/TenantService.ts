import { ConflictError, NotFoundError } from '../../../../@shared/infrastructure/error/AppError';
import { Tenant, ITenant, TenantConfig } from '../../domain/Tenant';
import { DomainEvent } from '../../../../@shared/domain/DomainEvent';

interface CreateTenantInput {
  name: string;
  slug: string;
  ownerId: string;
  businessType: string;
  billingEmail: string;
  owner?: {
    email?: string;
    password?: string;
    displayName?: string;
  };
}

interface TenantServiceDeps {
  tenantRepository: any;
  eventBus?: {
    publishAsync?: (event: DomainEvent) => Promise<void>;
    publish?: (event: DomainEvent) => void;
  };
}

export class TenantService {
  constructor(
    private readonly tenantRepository: any,
    private readonly eventBus?: TenantServiceDeps['eventBus'],
  ) {}

  async create(input: CreateTenantInput): Promise<Tenant> {
    const existing = await this.tenantRepository.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError('Tenant slug already exists');
    }

    const tenant = Tenant.create({
      name: input.name,
      slug: input.slug,
      domain: null,
      ownerId: input.ownerId,
      plan: 'trial',
      status: 'trial',
      businessType: input.businessType as ITenant['businessType'],
      modules: [input.businessType],
      databaseName: `posmono_${input.slug}`,
      config: {
        timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id',
        taxRate: 0.1, taxName: 'Pajak',
        ppnEnabled: true, ppnRate: 0.12,
        serviceChargeEnabled: false, serviceChargeRate: 0, serviceChargeName: 'Service Charge',
        discountMaxPercent: 100, discountMaxNominal: 1_000_000,
        receiptFooter: 'Terima kasih telah berbelanja',
        receiptLogo: '',
        roundingEnabled: false,
        roundingMode: 'nearest',
        roundingDenomination: 0,
        autoPrintReceipt: true,
        autoPrintKot: false,
      },
      billingEmail: input.billingEmail,
    });

    const event = new DomainEvent({
      eventName: 'platform.tenant.created',
      aggregateId: tenant.id.toValue(),
      aggregateType: 'Tenant',
      tenantId: tenant.id.toValue(),
      payload: {
        tenantId: tenant.id.toValue(),
        ownerId: input.ownerId,
        owner: input.owner ?? null,
        plan: tenant.serialize().plan,
        businessType: tenant.serialize().businessType,
      },
    });

    await this.tenantRepository.save(tenant);

    if (this.eventBus?.publishAsync) {
      await this.eventBus.publishAsync(event);
    } else if (this.eventBus?.publish) {
      this.eventBus.publish(event);
    }

    return tenant;
  }

  async getById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(id);
    if (!tenant) {
      throw new NotFoundError('Tenant');
    }
    return tenant;
  }

  async getBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepository.findBySlug(slug);
  }

  async list(options: { hubId?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(options.page ?? 1, 1);
    const limit = Math.max(options.limit ?? 50, 1);
    const { items, total } = await this.tenantRepository.list({
      hubId: options.hubId ?? null,
      search: options.search,
      limit,
      skip: (page - 1) * limit,
    });
    return { data: items.map((t: Tenant) => t.serialize()), total, page, limit };
  }

  async updateConfig(id: string, config: Partial<TenantConfig>): Promise<Tenant> {
    const tenant = await this.getById(id);
    tenant.updateConfig(config);
    await this.tenantRepository.save(tenant);
    return tenant;
  }

  async updateStatus(id: string, status: 'active' | 'frozen' | 'suspended' | 'deactivated', reason?: string): Promise<Tenant> {
    const tenant = await this.getById(id);
    if (status === 'active') tenant.activate();
    else if (status === 'frozen') tenant.freeze();
    else if (status === 'suspended') tenant.suspend(reason ?? 'Suspended by admin');
    else if (status === 'deactivated') tenant.deactivate();
    await this.tenantRepository.save(tenant);
    return tenant;
  }

  async extendSubscription(id: string, days: number): Promise<Tenant> {
    const tenant = await this.getById(id);
    tenant.extendSubscription(days);
    await this.tenantRepository.save(tenant);
    return tenant;
  }

  async getSubscription(id: string) {
    const tenant = await this.getById(id);
    const data = tenant.serialize();
    const expiresAt = data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt) : null;
    const now = new Date();
    const daysRemaining = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    return {
      plan: data.plan,
      status: data.status,
      subscriptionExpiresAt: data.subscriptionExpiresAt,
      daysRemaining: Math.max(daysRemaining, 0),
    };
  }
}
