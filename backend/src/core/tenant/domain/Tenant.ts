import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { TenantId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';
import { BusinessType } from '@posmono/shared';

export interface ITenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  ownerId: string;
  plan: string;
  status: TenantStatus;
  businessType: BusinessType;
  businessCategory: string;
  address: string;
  phone: string;
  modules: string[];
  databaseName: string;
  config: TenantConfig;
  billingEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';

export interface TenantConfig {
  timezone: string;
  currency: string;
  locale: string;
  taxRate: number;
  taxName: string;
  ppnEnabled: boolean;
  ppnRate: number;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  serviceChargeName: string;
  discountMaxPercent: number;
  discountMaxNominal: number;
  receiptFooter: string;
}

export class Tenant extends AggregateRoot<TenantId> {
  private name: string;
  private slug: string;
  private domain: string | null;
  private ownerId: string;
  private plan: string;
  private status: TenantStatus;
  private businessType: BusinessType;
  private businessCategory: string;
  private address: string;
  private phone: string;
  private modules: string[];
  private databaseName: string;
  private config: TenantConfig;
  private billingEmail: string;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: ITenant) {
    super(new TenantId(props.id));
    this.name = props.name;
    this.slug = props.slug;
    this.domain = props.domain;
    this.ownerId = props.ownerId;
    this.plan = props.plan;
    this.status = props.status;
    this.businessType = props.businessType;
    this.businessCategory = props.businessCategory || '';
    this.address = props.address || '';
    this.phone = props.phone || '';
    this.modules = [...props.modules];
    this.databaseName = props.databaseName;
    this.config = { ...props.config };
    this.billingEmail = props.billingEmail;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<ITenant, 'id' | 'createdAt' | 'updatedAt' | 'businessCategory' | 'address' | 'phone'>): Tenant {
    const tenant = new Tenant({
      ...props,
      id: new TenantId().toValue(),
      businessCategory: '',
      address: '',
      phone: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    tenant.addDomainEvent(
      new DomainEvent({
        eventName: 'platform.tenant.created',
        aggregateId: tenant.id.toValue(),
        aggregateType: 'Tenant',
        tenantId: tenant.id.toValue(),
        payload: {
          tenantId: tenant.id.toValue(),
          ownerId: tenant.ownerId,
          plan: tenant.plan,
          businessType: tenant.businessType,
        },
      }),
    );

    return tenant;
  }

  static hydrate(props: ITenant): Tenant {
    return new Tenant(props);
  }

  serialize(): ITenant {
    return {
      id: this._id.toValue(),
      name: this.name,
      slug: this.slug,
      domain: this.domain,
      ownerId: this.ownerId,
      plan: this.plan,
      status: this.status,
      businessType: this.businessType,
      businessCategory: this.businessCategory,
      address: this.address,
      phone: this.phone,
      modules: [...this.modules],
      databaseName: this.databaseName,
      config: { ...this.config },
      billingEmail: this.billingEmail,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  updateProfile(data: { name?: string; businessCategory?: string; address?: string; phone?: string }): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.businessCategory !== undefined) this.businessCategory = data.businessCategory;
    if (data.address !== undefined) this.address = data.address;
    if (data.phone !== undefined) this.phone = data.phone;
    this.updatedAt = new Date();
  }

  isActive(): boolean {
    return this.status === 'active' || this.status === 'trial';
  }

  suspend(reason: string): void {
    this.status = 'suspended';
    this.updatedAt = new Date();
    this.addDomainEvent(
      new DomainEvent({
        eventName: 'platform.tenant.suspended',
        aggregateId: this.id.toValue(),
        aggregateType: 'Tenant',
        tenantId: this.id.toValue(),
        payload: { tenantId: this.id.toValue(), reason },
      }),
    );
  }

  activate(): void {
    this.status = 'active';
    this.updatedAt = new Date();
  }

  enableModule(moduleName: string): void {
    if (!this.modules.includes(moduleName)) {
      this.modules.push(moduleName);
      this.updatedAt = new Date();
    }
  }

  disableModule(moduleName: string): void {
    this.modules = this.modules.filter((m) => m !== moduleName);
    this.updatedAt = new Date();
  }

  hasModule(moduleName: string): boolean {
    return this.modules.includes(moduleName);
  }

  updateConfig(partial: Partial<TenantConfig>): void {
    this.config = { ...this.config, ...partial };
    this.updatedAt = new Date();
  }

  get configValue(): TenantConfig {
    return { ...this.config };
  }
}
