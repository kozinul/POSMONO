import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  isMember: boolean;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt: string | null;
  tags: string[];
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface CustomersResponse {
  success: boolean;
  data: Customer[];
  meta: { total: number; page: number; limit: number };
}

export function useMembers(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['members', params],
    queryFn: async () => {
      const res = await api.get<CustomersResponse>('/members', { params });
      return res.data;
    },
  });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; phone?: string; email?: string; address?: string; isMember?: boolean; tags?: string[] }) => {
      const res = await api.post('/members', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; phone?: string; email?: string; address?: string; isMember?: boolean; tags?: string[] }) => {
      const res = await api.put(`/members/${id}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/members/${id}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}
