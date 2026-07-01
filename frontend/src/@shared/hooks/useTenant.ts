import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface TenantConfig {
  timezone: string;
  currency: string;
  locale: string;
  taxRate: number;
  taxName: string;
  ppnEnabled: boolean;
  ppnRate: number;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  serviceChargeName: string;
  discountMaxPercent: number;
  discountMaxNominal: number;
  receiptFooter: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  businessCategory: string;
  address: string;
  phone: string;
  plan: string;
  config: TenantConfig;
}

export function useTenant() {
  return useQuery<Tenant>({
    queryKey: ['tenant'],
    queryFn: async () => {
      const { data } = await api.get('/tenants/current');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<TenantConfig>) => {
      const { data } = await api.patch('/tenants/current/settings', settings);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant'] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: { name?: string; businessCategory?: string; address?: string; phone?: string }) => {
      const { data } = await api.patch('/tenants/current/profile', profile);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant'] }),
  });
}
