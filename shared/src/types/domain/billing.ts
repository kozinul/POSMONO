export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | 'trial';

export interface PlanLimits {
  maxUsers: number;
  maxProducts: number;
  maxCategories: number;
  maxOutlets: number;
  maxOrdersPerMonth: number;
  maxInventoryItems: number;
  maxWarehouses: number;
}

export interface PlanAddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'module' | 'limit';
  value: string | number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  billingCycle: 'monthly' | 'annual' | 'custom';
  isActive: boolean;
  isPublic: boolean;
  isDefault: boolean;
  sortOrder: number;
  modules: string[];
  limits: PlanLimits;
  addOns: PlanAddOn[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'annual' | 'custom';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  number: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: Date;
  paidAt: Date | null;
  lineItems: InvoiceLineItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
  total: number;
}
