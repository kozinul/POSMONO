import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface Stock {
  id: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minLevel: number;
  maxLevel: number;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  referenceType: string;
  referenceId: string;
  notes: string;
  userId: string;
  createdAt: string;
}

export function useStockList(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['inventory', 'stocks'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Stock[] }>('/inventory');
      return res.data.data;
    },
    staleTime: 5_000,
    refetchInterval: options?.refetchInterval ?? 5_000,
  });
}

export function useStockMovements(productId?: string) {
  return useQuery({
    queryKey: ['inventory', 'movements', productId ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (productId) params.set('productId', productId);
      const res = await api.get<{ success: boolean; data: StockMovement[] }>(
        `/inventory/movements?${params}`,
      );
      return res.data.data;
    },
    staleTime: 10_000,
  });
}

export function useStockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; quantity: number; reason?: string }) =>
      api.post('/inventory/stock-in', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useStockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; quantity: number; reason?: string }) =>
      api.post('/inventory/stock-out', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; delta: number; reason: string }) =>
      api.post('/inventory/adjust', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
