import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface InventorySummaryItem {
  productId: string;
  warehouseId: string;
  warehouseName?: string;
  productName?: string;
  sku?: string;
  categoryName?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minLevel: number;
  maxLevel: number;
  costPrice: number;
  value: number;
  openingQuantity: number;
  openingReservedQuantity: number;
  openingAvailableQuantity: number;
  openingValue: number;
  lowStock: boolean;
  movements: {
    in: number;
    out: number;
    adjustment: number;
    void: number;
    reserve: number;
    release: number;
  };
}

export interface InventorySummaryReport {
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  items: InventorySummaryItem[];
  totals: {
    totalItems: number;
    totalReserved: number;
    totalAvailable: number;
    totalValue: number;
    totalOpeningItems: number;
    totalOpeningValue: number;
  };
  lowStockCount: number;
}

export function useInventorySummaryReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['inventory-summary', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: InventorySummaryReport }>(
        `/reports/inventory-summary?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      return res.data.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });
}