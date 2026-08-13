import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface RefundablePayment {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  cashierName: string;
  orderTotal: number;
  amount: number;
  method: string;
  referenceNumber: string;
  provider: string | null;
  cardLastFour: string | null;
  paidAt: string | null;
  shiftClosedAt: string | null;
}

export interface RefundRow {
  refundId: string;
  orderId: string;
  orderNumber: string;
  cashierName: string;
  amount: number;
  reason: string;
  refundedBy: string;
  refundedByName: string;
  refundedAt: string;
  method: string;
  referenceNumber: string;
  provider: string | null;
  cardLastFour: string | null;
}

export interface RefundReport {
  dateFrom: string;
  dateTo: string;
  totalRefunds: number;
  totalAmount: number;
  refunds: RefundRow[];
}

export function useRefundable(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['refundable', dateFrom, dateTo],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (dateFrom) searchParams.set('dateFrom', dateFrom);
      if (dateTo) searchParams.set('dateTo', dateTo);
      const res = await api.get<{ success: boolean; data: RefundablePayment[] }>(`/payments/refundable?${searchParams.toString()}`);
      return res.data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useRefundMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      paymentId,
      reason,
      refundedByName,
    }: {
      paymentId: string;
      reason: string;
      refundedByName: string;
    }) => {
      const res = await api.post<{ success: boolean; data: unknown }>(`/payments/${paymentId}/refund`, {
        reason,
        refundedByName,
      });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refundable'] });
      qc.invalidateQueries({ queryKey: ['refunds-report'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['daily-report'] });
      qc.invalidateQueries({ queryKey: ['sales-report'] });
      qc.invalidateQueries({ queryKey: ['finance-report'] });
      qc.invalidateQueries({ queryKey: ['shift-report'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useRefundReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['refunds-report', dateFrom, dateTo],
    queryFn: async () => {
      const searchParams = new URLSearchParams({ dateFrom, dateTo });
      const res = await api.get<{ success: boolean; data: RefundReport }>(`/reports/refunds?${searchParams.toString()}`);
      return res.data.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });
}

export function refundReference(row: RefundablePayment | RefundRow): string {
  if (row.method === 'cash') return 'TUNAI';
  return row.referenceNumber || row.provider || row.cardLastFour || '-';
}
