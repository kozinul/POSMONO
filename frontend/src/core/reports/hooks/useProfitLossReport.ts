import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface ProfitLossReport {
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  totalOrders: number;
  totalRevenue: number;
  totalCogs: number;
  cogsUnits: number;
  totalDiscount: number;
  totalTax: number;
  totalServiceCharge: number;
  totalRounding: number;
  grossProfit: number;
  netProfit: number;
  grossMarginPct: number;
}

export function useProfitLossReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['profit-loss', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ProfitLossReport }>(
        `/reports/profit-loss?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      return res.data.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });
}