import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface ProductTransaction {
  orderId: string;
  createdAt: string;
  quantity: number;
  unitPrice: number;
  dpp: number;
  serviceCharge: number;
  tax: number;
}

export interface SalesPerProductRow {
  productId: string;
  productName: string;
  quantity: number;
  totalSales: number;
  dpp: number;
  serviceCharge: number;
  tax: number;
  transactions: ProductTransaction[];
}

export interface SalesPerProductSummary {
  quantity: number;
  totalSales: number;
  dpp: number;
  serviceCharge: number;
  tax: number;
  grandTotal: number;
}

export function useSalesPerProductReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['sales-per-product', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SalesPerProductRow[] }>(
        `/reports/sales-per-product?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      const rows: SalesPerProductRow[] = res.data.data;

      const summary: SalesPerProductSummary = rows.reduce(
        (acc, r) => ({
          quantity: acc.quantity + r.quantity,
          totalSales: acc.totalSales + r.totalSales,
          dpp: acc.dpp + r.dpp,
          serviceCharge: acc.serviceCharge + r.serviceCharge,
          tax: acc.tax + r.tax,
          grandTotal: acc.grandTotal + r.dpp + r.tax + r.serviceCharge,
        }),
        { quantity: 0, totalSales: 0, dpp: 0, serviceCharge: 0, tax: 0, grandTotal: 0 },
      );

      return { rows, summary };
    },
    enabled: !!dateFrom && !!dateTo,
  });
}
