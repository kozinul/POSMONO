import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface SalesPerCashierRow {
  cashierId: string;
  cashierName: string;
  totalOrders: number;
  totalItems: number;
  totalRevenue: number;
  dpp: number;
  serviceCharge: number;
  tax: number;
  avgOrderValue: number;
}

export interface SalesPerCashierReport {
  cashiers: SalesPerCashierRow[];
  totals: {
    totalOrders: number;
    totalItems: number;
    totalRevenue: number;
    dpp: number;
    serviceCharge: number;
    tax: number;
  };
}

export function useSalesPerCashierReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['sales-per-cashier', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SalesPerCashierReport }>(
        `/reports/sales-per-cashier?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      return res.data.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });
}