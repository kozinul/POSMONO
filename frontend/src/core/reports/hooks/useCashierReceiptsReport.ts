import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface MethodTotal {
  method: string;
  total: number;
  count: number;
}

export interface CashierReceipt {
  cashierId: string;
  cashierName: string;
  methods: MethodTotal[];
  total: number;
  totalTransactions: number;
}

export interface CashierReceiptsReport {
  cashiers: CashierReceipt[];
  totals: {
    total: number;
    totalTransactions: number;
    methods: Array<{ method: string; total: number }>;
  };
}

export function useCashierReceiptsReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['cashier-receipts', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: CashierReceiptsReport }>(
        `/reports/cashier-receipts?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      return res.data.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });
}