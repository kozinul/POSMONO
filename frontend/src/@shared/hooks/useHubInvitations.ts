import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { HubMemberRole } from './useHubMemberships';

/**
 * Hub V2 Fase 20 — invitations.
 *
 * Two audiences share this file because they share one server contract, but the
 * routes are deliberately different: administration lives under
 * `/api/hubs/:hubId/invitations` (platform admin, `platform.hubs.manage`) and
 * redeeming lives under `/api/hub-invitations/:token` (any signed-in user, whose
 * own address must match the invitation).
 *
 * The raw token is **not** re-fetchable: the server only stores a SHA-256 digest
 * and hands the token back once, on create. That is why `createdToken` lives in
 * component state (`HubInvitationPanel`) and not in the cache — putting it in a
 * query would make it look re-readable.
 */

export type HubInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export const HUB_INVITATION_STATUS_LABELS: Record<HubInvitationStatus, string> = {
  pending: 'Menunggu',
  accepted: 'Diterima',
  expired: 'Kedaluwarsa',
  revoked: 'Dicabut',
};

export interface HubInvitation {
  id: string;
  hubId: string;
  email: string;
  role: HubMemberRole;
  roleLabel: string;
  status: HubInvitationStatus;
  isExpired: boolean;
  acceptedBy: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHubInvitationInput {
  hubId: string;
  email: string;
  role: HubMemberRole;
  expiresInHours?: number;
}

export interface CreatedHubInvitation {
  invitation: HubInvitation;
  /** Shown once; the server cannot repeat it. */
  token: string;
}

/**
 * What the invitee is shown. Note this is a *narrower* shape than
 * `HubInvitation`: no `invitedBy`, no digest-adjacent fields, and the status is
 * already the effective one (a lapsed invite comes back as `expired`).
 */
export interface HubInvitationPreview {
  hubId: string;
  hubName: string;
  email: string;
  role: HubMemberRole;
  roleLabel: string;
  status: HubInvitationStatus;
  expiresAt: string;
  /** The signed-in account's address, so a mismatch can be explained. */
  currentUserEmail: string | null;
  emailMatches: boolean;
  alreadyMember: boolean;
}

export interface AcceptedHubInvitation {
  hubId: string;
  hubName: string;
  /** False when the user was already a member — the invitation is just spent. */
  created: boolean;
  membership: {
    id: string;
    hubId: string;
    userId: string;
    role: HubMemberRole;
  };
}

function invalidateInvitations(queryClient: ReturnType<typeof useQueryClient>, hubId: string) {
  queryClient.invalidateQueries({ queryKey: ['hub-invitations', hubId] });
  queryClient.invalidateQueries({ queryKey: ['platform-audit'] });
  // Accepting creates a membership, so every hub-scoped member view is stale.
  queryClient.invalidateQueries({ queryKey: ['hub-members'] });
  queryClient.invalidateQueries({ queryKey: ['hub-context'] });
  queryClient.invalidateQueries({ queryKey: ['accessible-tenants'] });
  queryClient.invalidateQueries({ queryKey: ['my-hub-memberships'] });
}

export function useHubInvitations(hubId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['hub-invitations', hubId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: HubInvitation[] }>(
        `/hubs/${hubId}/invitations`,
      );
      return res.data.data;
    },
    enabled: !!hubId && options?.enabled !== false,
    staleTime: 30_000,
  });
}

export function useCreateHubInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHubInvitationInput) =>
      api.post<{ success: boolean; data: CreatedHubInvitation }>(`/hubs/${input.hubId}/invitations`, {
        email: input.email,
        role: input.role,
        ...(input.expiresInHours ? { expiresInHours: input.expiresInHours } : {}),
      }),
    onSuccess: (_data, variables) => {
      invalidateInvitations(queryClient, variables.hubId);
    },
  });
}

export function useRevokeHubInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { hubId: string; invitationId: string }) =>
      api.delete<{ success: boolean; data: HubInvitation }>(
        `/hubs/${input.hubId}/invitations/${input.invitationId}`,
      ),
    onSuccess: (_data, variables) => {
      invalidateInvitations(queryClient, variables.hubId);
    },
  });
}

/**
 * The invitee's side. `retry: false` because every failure mode here is a real
 * answer — an expired or revoked link is not a transient error, and retrying
 * would just delay telling the user what happened.
 */
export function useHubInvitationPreview(token: string | null) {
  return useQuery({
    queryKey: ['hub-invitation-preview', token],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: HubInvitationPreview }>(
        `/hub-invitations/${token}`,
      );
      return res.data.data;
    },
    enabled: !!token,
    staleTime: 0,
    retry: false,
  });
}

export function useAcceptHubInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api.post<{ success: boolean; data: AcceptedHubInvitation }>(
        `/hub-invitations/${token}/accept`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub-invitation-preview'] });
      queryClient.invalidateQueries({ queryKey: ['hub-context'] });
      queryClient.invalidateQueries({ queryKey: ['accessible-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['my-hub-memberships'] });
    },
  });
}
