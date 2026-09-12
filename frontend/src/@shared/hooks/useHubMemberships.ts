import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface HubMember {
  id: string;
  hubId: string;
  userId: string;
  role: 'owner' | 'admin' | 'viewer';
  displayName: string | null;
  email: string | null;
  userTenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessibleTenant {
  tenantId: string;
  tenantName: string;
  hubId: string;
  hubName: string;
  role: string;
}

export function useHubMembers(hubId: string | null) {
  return useQuery({
    queryKey: ['hub-members', hubId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: HubMember[] }>(`/hub-memberships/hub/${hubId}`);
      return res.data.data;
    },
    enabled: !!hubId,
    staleTime: 30_000,
  });
}

export function useAddHubMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { hubId: string; userId: string; role: string }) =>
      api.post('/hub-memberships', input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hub-members', variables.hubId] });
    },
  });
}

export function useUpdateHubMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { hubId: string; userId: string; role: string }) =>
      api.put(`/hub-memberships/${input.hubId}/${input.userId}`, { role: input.role }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hub-members', variables.hubId] });
    },
  });
}

export function useRemoveHubMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { hubId: string; userId: string }) =>
      api.delete(`/hub-memberships/${input.hubId}/${input.userId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hub-members', variables.hubId] });
    },
  });
}

export function useAccessibleTenants() {
  return useQuery({
    queryKey: ['accessible-tenants'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AccessibleTenant[] }>('/auth/accessible-tenants');
      return res.data.data;
    },
    staleTime: 60_000,
    retry: false,
  });
}