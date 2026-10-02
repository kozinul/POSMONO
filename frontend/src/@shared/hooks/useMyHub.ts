import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { HubOverview } from './useHubOverview';
import type { HubStatus } from './usePlatform';

/**
 * Hub V2 Fase 22 — the member's own hub reads (`/api/hub`).
 *
 * Every hook here is read-only, mirroring the Fase 21 backend contract. The
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

interface MyHubQueryOptions {
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