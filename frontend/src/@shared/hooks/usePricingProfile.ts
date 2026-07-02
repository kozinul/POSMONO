import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface IPricingProfile {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  taxRuleIds: string[];
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function usePricingProfiles() {
  return useQuery<IPricingProfile[]>({
    queryKey: ['pricing-profiles'],
    queryFn: async () => {
      const { data } = await api.get('/pricing-profiles');
      return data;
    },
  });
}

export function usePricingProfile(id: string) {
  return useQuery<IPricingProfile>({
    queryKey: ['pricing-profiles', id],
    queryFn: async () => {
      const { data } = await api.get(`/pricing-profiles/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreatePricingProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      taxRuleIds?: string[];
      isDefault?: boolean;
      active?: boolean;
    }) => {
      const { data } = await api.post('/pricing-profiles', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-profiles'] }),
  });
}

export function useUpdatePricingProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: {
      id: string;
      name?: string;
      description?: string;
      taxRuleIds?: string[];
      isDefault?: boolean;
      active?: boolean;
    }) => {
      const { data } = await api.put(`/pricing-profiles/${id}`, input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-profiles'] }),
  });
}

export function useDeletePricingProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pricing-profiles/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-profiles'] }),
  });
}
