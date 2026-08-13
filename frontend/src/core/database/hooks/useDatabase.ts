import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface DatabaseStats {
  orders: number;
  payments: number;
  refunds: number;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  tenantId: string;
  collections: {
    orders: unknown[];
    payments: unknown[];
    refunds: unknown[];
  };
}

export interface DeleteTransactionsResult {
  orders: number;
  payments: number;
  refunds: number;
  dailyMetrics: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export function useDatabaseStats(from?: string, to?: string) {
  return useQuery({
    queryKey: ['database-stats', from ?? '', to ?? ''],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DatabaseStats>>('/database/stats', {
        params: { from, to },
      });
      return res.data.data;
    },
  });
}

export function useBackup() {
  return useMutation({
    mutationFn: async (input: { from?: string; to?: string }) => {
      const res = await api.get<ApiResponse<BackupData>>('/database/backup', {
        params: input,
      });
      return res.data.data;
    },
  });
}

export function useRestore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<BackupData['collections']>) => {
      const res = await api.post<ApiResponse<{ orders: number; payments: number; refunds: number }>>(
        '/database/restore',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['open-shift'] });
      queryClient.invalidateQueries({ queryKey: ['shift-report'] });
    },
  });
}

export function useDeleteTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { from?: string; to?: string }) => {
      const res = await api.post<ApiResponse<DeleteTransactionsResult>>('/database/transactions/delete', input);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-stats'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sales-report'] });
      queryClient.invalidateQueries({ queryKey: ['finance-report'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['open-shift'] });
      queryClient.invalidateQueries({ queryKey: ['shift-report'] });
    },
  });
}
