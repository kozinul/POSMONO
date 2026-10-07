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

/**
 * Aligned with `backend/src/core/billing/domain/Subscription.ts`. The doc used
 * to drift (missing `startedAt/trialEndsAt/autoRenew/assignedAt/
 * cancellationReason`) which made the shared type a trap for consumers reading
 * a live subscription row.
 */
export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'annual' | 'custom';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  startedAt: Date | null;
  trialEndsAt: Date | null;
  autoRenew: boolean;
  assignedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionInvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

/**
 * Why an invoice was issued. `renewal` is the invoice-first merchant renew
 * (and future wallet/auto-renewal) path: settling one EXTENDS the subscription.
 * `plan_assigned`/`plan_changed`/`extended` come from platform admin actions
 * where the money was already collected offline — settling only marks the
 * invoice paid, it never re-extends.
 */
export type SubscriptionInvoiceReferenceType =
  | 'plan_assigned'
  | 'plan_changed'
  | 'renewal'
  | 'extended';

export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
  total: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  number: string;
  status: SubscriptionInvoiceStatus;
  amount: number;
  currency: 'IDR';
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  paidAt: Date | null;
  lineItems: InvoiceLineItem[];
  referenceType: SubscriptionInvoiceReferenceType;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentAttemptStatus = 'pending' | 'completed' | 'expired' | 'failed';

export interface PaymentAttemptGateway {
  provider: string | null;
  txId: string | null;
  vaNumber: string | null;
  qrUrl: string | null;
}

/**
 * One attempt to pay an invoice. An invoice can own many attempts (a gateway
 * run can expire or fail before a later attempt succeeds); settlement happens
 * exactly once, on the first attempt that reaches `completed`. Wallet debits
 * and VA/QRIS gateway runs plug into this shape without any migration.
 */
export interface PaymentAttempt {
  id: string;
  tenantId: string;
  invoiceId: string;
  number: string | null;
  amount: number;
  method: string;
  status: PaymentAttemptStatus;
  gateway: PaymentAttemptGateway | null;
  actorEmail: string | null;
  notes: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}