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
  planId: string | null;
  status: TenantStatus;
  subscriptionExpiresAt: Date | null;
  businessType: BusinessType;
  businessCategory: string;
  address: string;
  phone: string;
  modules: string[];
  databaseName: string;
  config: TenantConfig;
  billingEmail: string;
  hubId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled' | 'frozen' | 'deactivated';

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
  receiptLogo: string;
  roundingEnabled: boolean;
  roundingMode: 'nearest' | 'up' | 'down';
  roundingDenomination: number;
  autoPrintReceipt: boolean;
  autoPrintKot: boolean;
  qrisGatewayEnabled?: boolean;
  qrisGatewayBaseUrl?: string;
  qrisGatewayApiKey?: string;
  qrisGatewayMerchantId?: string;
}

export class Tenant extends AggregateRoot<TenantId> {
  private name: string;
  private slug: string;
  private domain: string | null;
  private ownerId: string;
  private plan: string;
  private planId: string | null;
  private status: TenantStatus;
  private subscriptionExpiresAt: Date | null;
  private businessType: BusinessType;
  private businessCategory: string;
  private address: string;
  private phone: string;
  private modules: string[];
  private databaseName: string;
  private config: TenantConfig;
  private billingEmail: string;
  private hubId: string | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: ITenant) {
    super(new TenantId(props.id));
    this.name = props.name;
    this.slug = props.slug;
    this.domain = props.domain;
    this.ownerId = props.ownerId;
    this.plan = props.plan;
    this.planId = props.planId ?? null;
    this.status = props.status;
    this.subscriptionExpiresAt = props.subscriptionExpiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    this.businessType = props.businessType;
    this.businessCategory = props.businessCategory || '';
    this.address = props.address || '';
    this.phone = props.phone || '';
    this.modules = [...props.modules];
    this.databaseName = props.databaseName;
    this.config = { ...props.config };
    this.billingEmail = props.billingEmail;
    this.hubId = props.hubId ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<ITenant, 'id' | 'createdAt' | 'updatedAt' | 'businessCategory' | 'address' | 'phone' | 'hubId' | 'planId' | 'subscriptionExpiresAt'> & { subscriptionExpiresAt?: Date }): Tenant {
    const tenant = new Tenant({
      ...props,
      id: new TenantId().toValue(),
      planId: null,
      subscriptionExpiresAt: props.subscriptionExpiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      businessCategory: '',
      address: '',
      phone: '',
      hubId: null,
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
      planId: this.planId,
      status: this.status,
      subscriptionExpiresAt: this.subscriptionExpiresAt,
      businessType: this.businessType,
      businessCategory: this.businessCategory,
      address: this.address,
      phone: this.phone,
      modules: [...this.modules],
      databaseName: this.databaseName,
      config: { ...this.config },
      billingEmail: this.billingEmail,
      hubId: this.hubId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  assignHub(hubId: string): void {
    this.hubId = hubId;
    this.updatedAt = new Date();
  }

  unassignHub(): void {
    this.hubId = null;
    this.updatedAt = new Date();
  }

  updateProfile(data: { name?: string; businessCategory?: string; businessType?: BusinessType; address?: string; phone?: string }): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.businessCategory !== undefined) this.businessCategory = data.businessCategory;
    if (data.businessType !== undefined) this.businessType = data.businessType;
    if (data.address !== undefined) this.address = data.address;
    if (data.phone !== undefined) this.phone = data.phone;
    this.updatedAt = new Date();
  }

  isActive(): boolean {
    return this.status === 'active' || this.status === 'trial';
  }

  freeze(): void {
    this.status = 'frozen';
    this.updatedAt = new Date();
  }

  unfreeze(): void {
    this.status = 'active';
    this.updatedAt = new Date();
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

  deactivate(): void {
    this.status = 'deactivated';
    this.updatedAt = new Date();
  }

  assignPlan(planId: string, planName: string, modules: string[], expiresAt: Date): void {
    this.planId = planId;
    this.plan = planName;
    this.modules = [...modules];
    this.subscriptionExpiresAt = expiresAt;
    this.status = 'active';
    this.updatedAt = new Date();
  }

  extendSubscription(days: number): void {
    const current = this.subscriptionExpiresAt && this.subscriptionExpiresAt > new Date() ? this.subscriptionExpiresAt : new Date();
    this.subscriptionExpiresAt = new Date(current.getTime() + days * 24 * 60 * 60 * 1000);
    if (this.status === 'suspended' || this.status === 'frozen' || this.status === 'trial') {
      this.status = 'active';
    }
    this.updatedAt = new Date();
  }

  setSubscriptionExpiry(date: Date): void {
    this.subscriptionExpiresAt = date;
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
