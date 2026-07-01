import { ConflictError, NotFoundError } from '../../../../@shared/infrastructure/error/AppError';
import { Tenant, ITenant, TenantConfig } from '../../domain/Tenant';

interface CreateTenantInput {
  name: string;
  slug: string;
  ownerId: string;
  businessType: string;
  billingEmail: string;
}

export class TenantService {
  constructor(private readonly tenantRepository: any) {}

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
        taxRate: 0.1, taxName: 'PPN',
        ppnEnabled: true, ppnRate: 0.11,
        serviceChargeEnabled: false, serviceChargeRate: 0, serviceChargeName: 'Service Charge',
        discountMaxPercent: 100, discountMaxNominal: 1_000_000,
        receiptFooter: 'Terima kasih telah berbelanja',
      },
      billingEmail: input.billingEmail,
    });

    await this.tenantRepository.save(tenant);
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

  async updateConfig(id: string, config: Partial<TenantConfig>): Promise<Tenant> {
    const tenant = await this.getById(id);
    tenant.updateConfig(config);
    await this.tenantRepository.save(tenant);
    return tenant;
  }

  async updateProfile(id: string, data: { name?: string; businessCategory?: string; address?: string; phone?: string }): Promise<Tenant> {
    const tenant = await this.getById(id);
    tenant.updateProfile(data);
    await this.tenantRepository.save(tenant);
    return tenant;
  }
}
