import { BusinessType } from '../../constants/business-types';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  ownerId: string;
  plan: string;
  status: TenantStatus;
  businessType: BusinessType;
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
  serviceChargeRate: number;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired';

export interface Plan {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'annual';
  features: Record<string, unknown>;
  isActive: boolean;
}
