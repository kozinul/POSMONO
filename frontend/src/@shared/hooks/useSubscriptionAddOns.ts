import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { PlatformPlanAddOn } from './usePlatform';

export interface TenantEntitlement {
  plan: {
    id: string;
    name: string;
    modules: string[];
    limits: Record<string, number>;
    addOns?: PlatformPlanAddOn[];
  } | null;
  subscription: {
    id: string;
    planId: string;
    status: string;
    enabledAddOns?: string[];
  } | null;
  modules: string[];
  limits: Record<string, number>;
  addOns: PlatformPlanAddOn[];
  enabledAddOns: string[];
}

function invalidateAddOnScope(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['platform-tenant-entitlement'] });
  queryClient.invalidateQueries({ queryKey: ['platform-tenant'] });
  queryClient.invalidateQueries({ queryKey: ['platform-tenant-subscription'] });
  queryClient.invalidateQueries({ queryKey: ['platform-tenant-subscription-history'] });
  queryClient.invalidateQueries({ queryKey: ['kds-access'] });
  queryClient.invalidateQueries({ queryKey: ['platform-audit'] });
}

export function usePlatformTenantEntitlement(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['platform-tenant-entitlement', tenantId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TenantEntitlement }>(
        `/platform/tenants/${tenantId}/entitlement`,
      );
      return res.data.data;
    },
    enabled: Boolean(tenantId),
    staleTime: 15_000,
  });
}

export function usePlatformSetAddOns(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (addOnIds: string[]) => {
      const res = await api.put<{
        success: boolean;
        data: { subscription: { enabledAddOns: string[] }; modules: string[] };
      }>(`/platform/tenants/${tenantId}/subscription/addons`, { addOnIds });
      return res.data.data;
    },
    onSuccess: () => invalidateAddOnScope(queryClient),
  });
}
