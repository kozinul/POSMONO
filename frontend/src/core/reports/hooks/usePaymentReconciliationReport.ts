import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface ReconciliationItem {
  method: string;
  paymentTotal: number;
  paymentCount: number;
  orderTotal: number;
  orderCount: number;
  pendingTotal: number;
  pendingCount: number;
  difference: number;
}

export interface PaymentReconciliationReport {
  items: ReconciliationItem[];
  totals: {
    paymentTotal: number;
    paymentCount: number;
    orderTotal: number;
    orderCount: number;
    pendingTotal: number;
    pendingCount: number;
    difference: number;
  };
  generatedAt: string;
}

export function usePaymentReconciliationReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['payment-reconciliation', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaymentReconciliationReport }>(
        `/reports/payment-reconciliation?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      return res.data.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });
}