import { BusinessType } from '../../constants/business-types';

export interface Tenant {
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
  autoPrintReceipt: boolean;
  autoPrintKot: boolean;
}

