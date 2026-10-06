import {
  HUB_MEMBER_ROLE_LABELS,
  HUB_MEMBER_ROLE_HINTS,
  type HubMemberRole,
} from '../../../@shared/hooks/useHubMemberships';

export const HUB_ROLES: HubMemberRole[] = ['owner', 'admin', 'manager', 'viewer'];

/**
 * Strength per hub role, **higher is stronger**.
 *
 * Explicit numbers rather than `array.indexOf`, because the array is ordered
 * widest-first (`owner` first) — so a bigger index means a *weaker* role and
 * every comparison written against it silently inverts. That produced a UI where
 * an owner could not manage a viewer, which is the exact opposite of the rule the
 * API enforces in `hubRoleRules`.
 */
const STRENGTH: Record<HubMemberRole, number> = {
  owner: 3,
  admin: 2,
  manager: 1,
  viewer: 0,
};

export function hubRoleStrength(role: string): number {
  return STRENGTH[role as HubMemberRole] ?? -1;
}

/** Roles this member may hand out: their own and everything below it. */
export function assignableHubRoles(actorRole: string): HubMemberRole[] {
  const strength = hubRoleStrength(actorRole);
  return HUB_ROLES.filter((r) => STRENGTH[r] <= strength);
}

/**
 * Whether `actorRole` may manage `member`. Strictly below, matching the API's
 * `assertMayManageMember`: a peer of equal rank is off limits, and `owner` — the
 * top — manages nobody from the member screen, which is what keeps a hub
 * administrable.
 */
export function canManageHubMember(
  actorRole: string,
  member: { userId: string; role: string },
  selfId: string,
): boolean {
  if (!selfId || member.userId === selfId) return false;
  return hubRoleStrength(actorRole) > hubRoleStrength(member.role);
}

export const HUB_ROLE_LABELS = HUB_MEMBER_ROLE_LABELS;
export const HUB_ROLE_HINTS = HUB_MEMBER_ROLE_HINTS;
