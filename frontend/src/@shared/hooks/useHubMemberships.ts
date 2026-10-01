import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { HubStatus } from './usePlatform';

export type HubMemberRole = 'owner' | 'admin' | 'manager' | 'viewer';

export const HUB_MEMBER_ROLES: HubMemberRole[] = ['owner', 'admin', 'manager', 'viewer'];

export const HUB_MEMBER_ROLE_LABELS: Record<HubMemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer',
};

export const HUB_MEMBER_ROLE_HINTS: Record<HubMemberRole, string> = {
  owner: 'Akses penuh lintas tenant di hub ini',
  admin: 'Kelola user & lihat laporan lintas tenant',
  manager: 'Operasional harian lintas tenant (tanpa kelola user)',
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
  /** Fase 17: present when the tenant is reached through an explicit grant. */
  tenantRole?: TenantAccessRole;
  outletIds?: string[];
  accessSource?: 'grant' | 'fallback';
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

/* ------------------------------------------------------------------ *
 * Hub V2 Fase 17 — per-tenant access grants
 *
 * The hub role says "which tenants exist in this group"; the grant says
 * "what this person may actually reach in tenant X". Before Fase 17 there
 * was only the hub role, so `owner` silently meant Owner in *every* tenant
 * of the hub.
 * ------------------------------------------------------------------ */

export type TenantAccessRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'viewer';

export const TENANT_ACCESS_ROLES: TenantAccessRole[] = [
  'owner',
  'admin',
  'manager',
  'cashier',
  'viewer',
];

export const TENANT_ACCESS_ROLE_LABELS: Record<TenantAccessRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Kasir',
  viewer: 'Viewer',
};

export const TENANT_ACCESS_ROLE_HINTS: Record<TenantAccessRole, string> = {
  owner: 'Akses penuh di tenant ini, termasuk pengaturan & pengguna',
  admin: 'Kelola user & laporan di tenant ini',
  manager: 'Operasional harian di tenant ini (tanpa kelola user)',
  cashier: 'Transaksi di kasir saja',
  viewer: 'Hanya baca data tenant ini',
};

export type HubAccessStatus = 'active' | 'suspended';

export const HUB_ACCESS_STATUS_LABELS: Record<HubAccessStatus, string> = {
  active: 'Aktif',
  suspended: 'Ditangguhkan',
};

export interface HubMemberAccessGrant {
  id: string;
  hubId: string;
  userId: string;
  tenantId: string;
  tenantRole: TenantAccessRole;
  /** `[]` means every outlet of the tenant. */
  outletIds: string[];
  status: HubAccessStatus;
  tenantRoleLabel: string;
  allOutlets: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveHubMemberAccessInput {
  hubId: string;
  userId: string;
  tenantId: string;
  tenantRole: TenantAccessRole;
  outletIds: string[];
  status?: HubAccessStatus;
}

/** Row of `/api/hub-context/me` — what the signed-in user can reach. */
export interface HubContext {
  /** Fase 18 adds `code`/`status`; `isActive` is the derived mirror. */
  hubs: { id: string; name: string; code?: string; status?: HubStatus; isActive: boolean }[];
  grants: HubMemberAccessGrant[];
  tenants: AccessibleTenant[];
  effectivePermissions: string[];
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

function invalidateMemberAccess(
  queryClient: ReturnType<typeof useQueryClient>,
  hubId: string,
  userId: string,
) {
  queryClient.invalidateQueries({ queryKey: ['hub-member-access', hubId, userId] });
  queryClient.invalidateQueries({ queryKey: ['platform-audit'] });
}

export function useHubMemberAccess(hubId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ['hub-member-access', hubId, userId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: HubMemberAccessGrant[] }>(
        `/hub-memberships/hub/${hubId}/${userId}/access`,
      );
      return res.data.data;
    },
    enabled: !!hubId && !!userId,
    staleTime: 30_000,
  });
}

export function useSaveHubMemberAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveHubMemberAccessInput) =>
      api.put(`/hub-memberships/hub/${input.hubId}/${input.userId}/access`, {
        tenantId: input.tenantId,
        tenantRole: input.tenantRole,
        outletIds: input.outletIds,
        ...(input.status ? { status: input.status } : {}),
      }),
    onSuccess: (_data, variables) => {
      invalidateMemberAccess(queryClient, variables.hubId, variables.userId);
    },
  });
}

export function useRevokeHubMemberAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { hubId: string; userId: string; tenantId: string }) =>
      api.delete(`/hub-memberships/hub/${input.hubId}/${input.userId}/access/${input.tenantId}`),
    onSuccess: (_data, variables) => {
      invalidateMemberAccess(queryClient, variables.hubId, variables.userId);
    },
  });
}

/** "What can I actually reach?" for the signed-in member. */
export function useHubContext() {
  return useQuery({
    queryKey: ['hub-context'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: HubContext }>('/hub-context/me');
      return res.data.data;
    },
    staleTime: 60_000,
    retry: false,
  });
}
