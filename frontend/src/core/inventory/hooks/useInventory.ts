import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';
import type { Stock, StockMovement, Warehouse } from '@posmono/shared';

export type { Stock, StockMovement, Warehouse };

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
    mutationFn: (input: { productId: string; quantity: number; reason?: string; warehouseId?: string }) =>
      api.post('/inventory/stock-in', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useStockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; quantity: number; reason?: string; warehouseId?: string }) =>
      api.post('/inventory/stock-out', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; delta: number; reason: string; warehouseId?: string }) =>
      api.post('/inventory/adjust', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useReserveStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; quantity: number; referenceId?: string }) =>
      api.post('/inventory/reserve', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useReleaseStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; quantity: number; referenceId?: string }) =>
      api.post('/inventory/release', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useExportStock() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.get<{ success: boolean; data: Array<{
        productId: string;
        productName: string;
        sku: string;
        quantity: number;
        reservedQuantity: number;
        minLevel: number;
        maxLevel: number;
        warehouseId: string;
      }> }>('/inventory/export');
      return res.data.data;
    },
  });
}

export function useImportStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { items: Array<{
      productId: string;
      quantity: number;
      minLevel?: number;
      maxLevel?: number;
      warehouseId?: string;
    }> }) => api.post('/inventory/import', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useWarehouseList() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Warehouse[] }>('/warehouses');
      return res.data.data;
    },
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; address?: string }) =>
      api.post('/warehouses', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; data: { name?: string; address?: string; isActive?: boolean } }) =>
      api.put(`/warehouses/${input.id}`, input.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/warehouses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}
