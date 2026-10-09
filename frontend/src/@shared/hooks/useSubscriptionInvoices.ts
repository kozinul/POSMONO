import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Subscription invoice surfaces (Terminal Center "Tagihan & Pembayaran").
 * Kept out of `usePlatform.ts` for the same reason as `useHubOverview.ts`: the
 * shared platform hook file is at the complexity budget's 1000-line ceiling.
 *
 * Amount rules live on the backend (`SubscriptionBillingService`): a manual
 * payment must match the invoice amount exactly, and settling a `renewal`
 * invoice is what extends the subscription. The UI only collects the fields.
 */
const BASE = '/platform';

export type PlatformInvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type PlatformInvoiceReferenceType = 'plan_assigned' | 'plan_changed' | 'renewal' | 'extended';
export type PlatformPaymentAttemptStatus = 'pending' | 'completed' | 'expired' | 'failed';

export interface PlatformInvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
  total: number;
}

export interface PlatformSubscriptionInvoice {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  number: string;
  status: PlatformInvoiceStatus;
  amount: number;
  currency: 'IDR';
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt: string | null;
  lineItems: PlatformInvoiceLineItem[];
  referenceType: PlatformInvoiceReferenceType;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformInvoicePaymentAttempt {
  id: string;
  tenantId: string;
  invoiceId: string;
  number: string | null;
  amount: number;
  method: string;
  status: PlatformPaymentAttemptStatus;
  gateway: { provider: string | null; txId: string | null; vaNumber: string | null; qrUrl: string | null } | null;
  actorEmail: string | null;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformTenantInvoices {
  items: PlatformSubscriptionInvoice[];
  totals: { outstanding: number; paid: number };
}

/**
 * Every settled invoice can move the invoice list, its attempts, the
 * subscription period, the tenant expiry, the history ledger AND the audit
 * trail — so all of them are invalidated together.
 */
function invalidateInvoiceScope(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['platform-tenant-invoices'] });
  queryClient.invalidateQueries({ queryKey: ['platform-invoice-payments'] });
  queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
  queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
  queryClient.invalidateQueries({ queryKey: ['platform-tenant-subscription'] });
  queryClient.invalidateQueries({ queryKey: ['platform-tenant-subscription-history'] });
  queryClient.invalidateQueries({ queryKey: ['platform-audit'] });
}

export function usePlatformTenantInvoices(tenantId: string | null) {
  return useQuery({
    queryKey: ['platform-tenant-invoices', tenantId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PlatformTenantInvoices }>(
        `${BASE}/tenants/${tenantId}/subscription/invoices`,
      );
      return res.data.data;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function usePlatformInvoicePayments(tenantId: string | null, invoiceId: string | null) {
  return useQuery({
    queryKey: ['platform-invoice-payments', tenantId, invoiceId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: PlatformInvoicePaymentAttempt[] } }>(
        `${BASE}/tenants/${tenantId}/subscription/invoices/${invoiceId}/payments`,
      );
      return res.data.data;
    },
    enabled: !!tenantId && !!invoiceId,
    staleTime: 15_000,
  });
}

export function usePlatformRecordInvoicePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      invoiceId,
      amount,
      method,
      referenceNumber,
      notes,
    }: {
      tenantId: string;
      invoiceId: string;
      amount: number;
      method: string;
      referenceNumber?: string;
      notes?: string;
    }) => {
      const res = await api.post<{ success: boolean; data: { invoice: PlatformSubscriptionInvoice } }>(
        `${BASE}/tenants/${tenantId}/subscription/invoices/${invoiceId}/pay`,
        { amount, method, referenceNumber, notes },
      );
      return res.data.data;
    },
    onSuccess: () => invalidateInvoiceScope(queryClient),
  });
}

export function usePlatformCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, invoiceId, reason }: { tenantId: string; invoiceId: string; reason?: string }) => {
      const res = await api.post<{ success: boolean; data: { invoice: PlatformSubscriptionInvoice } }>(
        `${BASE}/tenants/${tenantId}/subscription/invoices/${invoiceId}/cancel`,
        { reason },
      );
      return res.data.data;
    },
    onSuccess: () => invalidateInvoiceScope(queryClient),
  });
}
