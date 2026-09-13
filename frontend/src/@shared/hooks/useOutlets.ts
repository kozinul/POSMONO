import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from './useAuth';

export interface Outlet {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  phone: string | null;
  warehouseId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useOutlets() {
  return useQuery({
    queryKey: ['outlets'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Outlet[] }>('/outlets');
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function useActiveOutlet() {
  const activeOutletId = useAuthStore((s) => s.activeOutletId);
  const { data: outlets = [] } = useOutlets();
  return outlets.find((o) => o.id === activeOutletId) ?? null;
}

export function useUpdateOutlet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; data: { name?: string; address?: string; phone?: string; isActive?: boolean } }) =>
      api.put(`/outlets/${input.id}`, input.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outlets'] }),
  });
}