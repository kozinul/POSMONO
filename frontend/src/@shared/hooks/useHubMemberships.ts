import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export type HubMemberRole = 'owner' | 'admin' | 'viewer';

export const HUB_MEMBER_ROLES: HubMemberRole[] = ['owner', 'admin', 'viewer'];

export const HUB_MEMBER_ROLE_LABELS: Record<HubMemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  viewer: 'Viewer',
};

export const HUB_MEMBER_ROLE_HINTS: Record<HubMemberRole, string> = {
  owner: 'Akses penuh lintas tenant di hub ini',
  admin: 'Kelola user & lihat laporan lintas tenant',
  viewer: 'Hanya baca data lintas tenant',
};

export interface HubMember {
  id: string;
  hubId: string;
  userId: string;
  role: HubMemberRole;
  displayName: string | null;
  email: string | null;
  userTenantId: string | null;
  userTenantName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddHubMembershipInput {
  hubId: string;
  userId: string;
  role: HubMemberRole;
}

export interface UpdateHubMembershipInput {
  hubId: string;
  userId: string;
  role: HubMemberRole;
}

export interface RemoveHubMembershipInput {
  hubId: string;
  userId: string;
}

export interface AccessibleTenant {
  tenantId: string;
  tenantName: string;
  hubId: string;
  hubName: string;
  role: string;
}

export interface MyHubMembership {
  id: string;
  hubId: string;
  userId: string;
  role: HubMemberRole;
  hubName: string | null;
  createdAt: string;
  updatedAt: string;
}

function invalidateHubMembers(queryClient: ReturnType<typeof useQueryClient>, hubId: string) {
  queryClient.invalidateQueries({ queryKey: ['hub-members', hubId] });
  queryClient.invalidateQueries({ queryKey: ['platform-audit'] });
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
    mutationFn: (input: AddHubMembershipInput) => api.post('/hub-memberships', input),
    onSuccess: (_data, variables) => {
      invalidateHubMembers(queryClient, variables.hubId);
    },
  });
}

export function useUpdateHubMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateHubMembershipInput) =>
      api.put(`/hub-memberships/${input.hubId}/${input.userId}`, { role: input.role }),
    onSuccess: (_data, variables) => {
      invalidateHubMembers(queryClient, variables.hubId);
    },
  });
}

export function useRemoveHubMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RemoveHubMembershipInput) =>
      api.delete(`/hub-memberships/${input.hubId}/${input.userId}`),
    onSuccess: (_data, variables) => {
      invalidateHubMembers(queryClient, variables.hubId);
    },
  });
}

export function useMyHubMemberships() {
  return useQuery({
    queryKey: ['my-hub-memberships'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MyHubMembership[] }>('/hub-memberships/me');
      return res.data.data;
    },
    staleTime: 60_000,
    retry: false,
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
