import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { HubOverview } from './useHubOverview';
import type { HubStatus } from './usePlatform';

/**
 * Hub V2 Fase 22/24 — the member's own hub surface (`/api/hub`).
 *
 * Reads mirror the Fase 21 contract; the mutations below are Fase 24 and reuse the
 * Fase 17/20 service semantics behind the same `hub.*` guard. The
 * tenant JWT carries no `hub.*` permission, so **authorization for these screens
 * comes from the server, not from the auth store**: the role's permission list
 * arrives inside `MyHubRow.permissions` / `MyHubProfile.permissions` and the UI
 * hides what it does not carry. Hiding is a courtesy, not a guard — the endpoint
 * still answers 403, which is why each tab also gates its query with `enabled`.
 */

/** `hub.read` and friends, spelled for display. */
export const HUB_PERMISSION_LABELS: Record<string, string> = {
  'hub.read': 'Lihat profil hub',
  'hub.members.read': 'Lihat daftar anggota',
  'hub.members.manage': 'Kelola anggota',
  'hub.tenants.read': 'Lihat daftar tenant',
  'hub.tenants.manage': 'Kelola tenant hub',
  'hub.reports.read': 'Lihat laporan gabungan',
  'hub.reports.export': 'Ekspor laporan gabungan',
};

export interface MyHubRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: HubStatus;
  role: string;
  roleLabel: string;
  /** The `hub.*` namespace this role may use — the page's tab gating. */
  permissions: string[];
}

export interface MyHubProfile {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: HubStatus;
  isActive: boolean;
  ownerUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  role: string;
  roleLabel: string;
  permissions: string[];
}

/**
 * A tenant as a hub member sees it. Deliberately narrower than the platform
 * view: the backend projects field by field because `Tenant.serialize()` carries
 * `config`, which holds that business's QRIS gateway credentials.
 */
export interface MyHubTenant {
  id: string;
  name: string;
  status: string;
  businessType: string | null;
  businessCategory: string | null;
  address: string | null;
  phone: string | null;
  subscriptionExpiresAt: string | null;
}

export interface MyHubMember {
  id: string;
  hubId: string;
  userId: string;
  role: string;
  status: string;
  suspendedAt: string | null;
  displayName: string | null;
  email: string | null;
  userTenantId: string | null;
  userTenantName: string | null;
}

/** Same read model as the Terminal Center, reached through the member guard. */
export type MyHubOverview = Omit<HubOverview, 'hub'> & { hub: MyHubProfile };

export interface MyHubQueryOptions {
  /** Tab-level gating: a viewer never fires the members request just to get a 403. */
  enabled?: boolean;
}

function enabledFor(hubId: string | null, options?: MyHubQueryOptions): boolean {
  return !!hubId && options?.enabled !== false;
}

/**
 * Which hubs the signed-in person is in. `retry: false` — an empty list is the
 * answer for most accounts, not a transient failure, and retrying it on every
 * dashboard render would be noise.
 */
export function useMyHubs() {
  return useQuery({
    queryKey: ['my-hubs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MyHubRow[] }>('/hub/me/hubs');
      return res.data.data;
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useMyHub(hubId: string | null, options?: MyHubQueryOptions) {
  return useQuery({
    queryKey: ['my-hub', hubId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MyHubProfile }>(`/hub/${hubId}`);
      return res.data.data;
    },
    enabled: enabledFor(hubId, options),
    staleTime: 60_000,
  });
}

export function useMyHubTenants(hubId: string | null, options?: MyHubQueryOptions) {
  return useQuery({
    queryKey: ['my-hub-tenants', hubId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MyHubTenant[] }>(`/hub/${hubId}/tenants`);
      return res.data.data;
    },
    enabled: enabledFor(hubId, options),
    staleTime: 30_000,
  });
}

export function useMyHubMembers(hubId: string | null, options?: MyHubQueryOptions) {
  return useQuery({
    queryKey: ['my-hub-members', hubId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MyHubMember[] }>(`/hub/${hubId}/members`);
      return res.data.data;
    },
    enabled: enabledFor(hubId, options),
    staleTime: 30_000,
  });
}

export function useMyHubOverview(
  hubId: string | null,
  dateFrom: string,
  dateTo: string,
  options?: MyHubQueryOptions,
) {
  return useQuery({
    queryKey: ['my-hub-overview', hubId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const query = params.toString();
      const res = await api.get<{ success: boolean; data: MyHubOverview }>(
        `/hub/${hubId}/overview${query ? `?${query}` : ''}`,
      );
      return res.data.data;
    },
    enabled: enabledFor(hubId, options),
    staleTime: 60_000,
  });
}
// ---------------------------------------------------------------- Fase 24
// Mutations through the same `/api/hub` surface. Grouped in this file rather than
// a new one so the console's whole contract lives next to the reads it refreshes.

export interface HubCandidate {
  id: string;
  displayName: string | null;
  email: string | null;
  tenantId: string | null;
  tenantName: string | null;
  /** Already in this hub — the row is shown, just not addable again. */
  isMember: boolean;
}

export interface HubAccessGrant {
  id: string;
  hubId: string;
  userId: string;
  tenantId: string;
  tenantRole: string;
  outletIds: string[];
  status: string;
}

export interface HubInvitation {
  id: string;
  hubId: string;
  email: string;
  role: string;
  roleLabel: string;
  status: string;
  expiresAt: string;
  isExpired: boolean;
  createdAt: string;
}

/** The 201 payload: the raw token exists here and nowhere else. */
export interface CreatedHubInvitation {
  invitation: HubInvitation;
  token: string;
}

export interface AddHubMemberInput {
  hubId: string;
  userId: string;
  role: string;
}

export interface UpdateHubMemberRoleInput {
  hubId: string;
  userId: string;
  role: string;
}

export interface SetHubMemberStatusInput {
  hubId: string;
  userId: string;
  status: 'active' | 'suspended';
}

export interface RemoveHubMemberInput {
  hubId: string;
  userId: string;
}

export interface SaveHubGrantInput {
  hubId: string;
  userId: string;
  tenantId: string;
  tenantRole: string;
  outletIds?: string[];
}

export interface RevokeHubGrantInput {
  hubId: string;
  userId: string;
  tenantId: string;
}

export interface CreateHubInvitationInput {
  hubId: string;
  email: string;
  role: string;
  expiresInHours?: number;
}

/**
 * Invalidation on every mutation, deliberately including `platform-audit`: the
 * Terminal Center audit feed is where a hub-side change becomes visible to a
 * platform operator, so a stale list there hides a real action.
 */
function useHubAdminInvalidation() {
  const queryClient = useQueryClient();
  return (hubId: string) => {
    for (const key of [
      ['my-hub-members', hubId],
      ['my-hub-tenants', hubId],
      ['my-hub', hubId],
      ['my-hubs'],
      ['hub-context'],
      ['my-hub-candidates', hubId],
      ['my-hub-invitations', hubId],
      // Prefix match, deliberately: grants are keyed per member, and no shorter
      // key would reach them. `['my-hub-grants', hubId]` covers every member.
      ['my-hub-grants', hubId],
    ]) {
      queryClient.invalidateQueries({ queryKey: key as unknown as string[] });
    }
    queryClient.invalidateQueries({ queryKey: ['platform-audit'] });
  };
}

export function useHubCandidates(hubId: string | null, search: string, options?: MyHubQueryOptions) {
  return useQuery({
    queryKey: ['my-hub-candidates', hubId, search],
    queryFn: async () => {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api.get<{ success: boolean; data: { items: HubCandidate[]; total: number } }>(
        `/hub/${hubId}/members/candidates${query}`,
      );
      return res.data.data;
    },
    enabled: enabledFor(hubId, options),
    staleTime: 15_000,
    retry: false,
  });
}

export function useAddHubMember() {
  const invalidate = useHubAdminInvalidation();
  return useMutation({
    mutationFn: (input: AddHubMemberInput) =>
      api.post(`/hub/${input.hubId}/members`, { userId: input.userId, role: input.role }),
    onSuccess: (_data, variables) => invalidate(variables.hubId),
  });
}

export function useUpdateHubMemberRole() {
  const invalidate = useHubAdminInvalidation();
  return useMutation({
    mutationFn: (input: UpdateHubMemberRoleInput) =>
      api.put(`/hub/${input.hubId}/members/${input.userId}`, { role: input.role }),
    onSuccess: (_data, variables) => invalidate(variables.hubId),
  });
}

export function useSetHubMemberStatus() {
  const invalidate = useHubAdminInvalidation();
  return useMutation({
    mutationFn: (input: SetHubMemberStatusInput) =>
      api.put(`/hub/${input.hubId}/members/${input.userId}/status`, { status: input.status }),
    onSuccess: (_data, variables) => invalidate(variables.hubId),
  });
}

export function useRemoveHubMember() {
  const invalidate = useHubAdminInvalidation();
  return useMutation({
    mutationFn: (input: RemoveHubMemberInput) =>
      api.delete(`/hub/${input.hubId}/members/${input.userId}`),
    onSuccess: (_data, variables) => invalidate(variables.hubId),
  });
}

export function useHubMemberGrants(hubId: string | null, userId: string | null, options?: MyHubQueryOptions) {
  return useQuery({
    queryKey: ['my-hub-grants', hubId, userId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: HubAccessGrant[] }>(
        `/hub/${hubId}/members/${userId}/access`,
      );
      return res.data.data;
    },
    enabled: enabledFor(hubId, options) && !!userId,
    staleTime: 30_000,
  });
}

export function useSaveHubGrant() {
  const invalidate = useHubAdminInvalidation();
  return useMutation({
    mutationFn: (input: SaveHubGrantInput) =>
      api.put(`/hub/${input.hubId}/members/${input.userId}/access`, {
        tenantId: input.tenantId,
        tenantRole: input.tenantRole,
        outletIds: input.outletIds ?? [],
      }),
    onSuccess: (_data, variables) => invalidate(variables.hubId),
  });
}

export function useRevokeHubGrant() {
  const invalidate = useHubAdminInvalidation();
  return useMutation({
    mutationFn: (input: RevokeHubGrantInput) =>
      api.delete(`/hub/${input.hubId}/members/${input.userId}/access/${input.tenantId}`),
    onSuccess: (_data, variables) => invalidate(variables.hubId),
  });
}

export function useMyHubInvitations(hubId: string | null, options?: MyHubQueryOptions) {
  return useQuery({
    queryKey: ['my-hub-invitations', hubId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: HubInvitation[] }>(
        `/hub/${hubId}/invitations`,
      );
      return res.data.data;
    },
    enabled: enabledFor(hubId, options),
    staleTime: 15_000,
  });
}

export function useCreateHubInvitation() {
  const invalidate = useHubAdminInvalidation();
  return useMutation({
    mutationFn: (input: CreateHubInvitationInput) =>
      api.post(`/hub/${input.hubId}/invitations`, {
        email: input.email,
        role: input.role,
        expiresInHours: input.expiresInHours,
      }),
    onSuccess: (_data, variables) => invalidate(variables.hubId),
  });
}

export function useRevokeHubInvitation() {
  const invalidate = useHubAdminInvalidation();
  return useMutation({
    mutationFn: (input: { hubId: string; invitationId: string }) =>
      api.delete(`/hub/${input.hubId}/invitations/${input.invitationId}`),
    onSuccess: (_data, variables) => invalidate(variables.hubId),
  });
}
