import { ValidationError } from '../../../@shared/infrastructure/error/AppError';
import { TENANT_ACCESS_ROLES, type TenantAccessRole } from '../../platform/defaults/roles';
import type { HubMemberRole } from './HubMembership';

/**
 * Hub V2 Fase 24 — who may change whom inside a hub.
 *
 * `hub.members.manage` says "you are allowed to manage members", not "you may
 * manage every member". Those are different claims: the Terminal Center has an
 * operator behind it, whereas `/api/hub/*` is driven by a business person on a
 * phone. Without a ceiling, any `admin` could hand themselves `owner` or suspend
 * the last `owner`, leaving the hub with nobody able to administer it — and, in
 * the role-change case, silently widening their own reach.
 *
 * Kept as pure functions with no repository access so the rules can be tested
 * without a hub, a membership row, or an HTTP request.
 */

/** Higher means more authority. Only used for comparisons, never persisted. */
export const HUB_ROLE_RANK: Record<HubMemberRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  viewer: 1,
};

export interface HubActorContext {
  userId: string;
  role: HubMemberRole;
}

export interface HubMemberSummary {
  userId: string;
  role: HubMemberRole;
}

/**
 * Nobody edits their own row through this surface. Every one of these actions is
 * revocable from the other direction (an `owner` can undo an `admin`'s mistake),
 * but self-service is not: a member who demotes themselves can no longer undo it,
 * and one who suspends themselves simply loses the screen they were using.
 */
export function assertNotSelf(
  actor: HubActorContext,
  targetUserId: string,
  actionLabel: string,
): void {
  if (actor.userId === targetUserId) {
    throw new ValidationError(`Anda tidak bisa ${actionLabel} akun Anda sendiri di hub`);
  }
}

/**
 * Strictly greater rank, so peers cannot lock each other out: two `admin`s can
 * add each other back only through a third party, not by cancelling each other.
 *
 * The rule also makes an `owner` row immutable from this surface — nothing ranks
 * above `owner`, so an owner can neither be demoted, suspended nor removed here,
 * and cannot do that to themselves either (`assertNotSelf`). That is what keeps
 * a hub administrable at all times, which is why there is deliberately **no**
 * separate "last owner" guard to get out of step with this one: relaxing the
 * comparison below would open that hole, and the check that would have to appear
 * is not in this file today.
 */
export function assertMayManageMember(
  actor: HubActorContext,
  target: HubMemberSummary,
  actionLabel: string,
): void {
  assertNotSelf(actor, target.userId, actionLabel);
  if (HUB_ROLE_RANK[actor.role] <= HUB_ROLE_RANK[target.role]) {
    throw new ValidationError(
      `Role hub Anda (${actor.role}) tidak bisa ${actionLabel} anggota dengan role ${target.role} atau lebih tinggi`,
    );
  }
}

/** Assigning at your own level is allowed (that is how hubs grow); above it is not. */
export function assertMayAssignHubRole(actor: HubActorContext, role: HubMemberRole): void {
  if (HUB_ROLE_RANK[role] > HUB_ROLE_RANK[actor.role]) {
    throw new ValidationError(
      `Role hub Anda (${actor.role}) tidak bisa memberikan role ${role}`,
    );
  }
}

/**
 * The highest tenant role each hub role may hand out; `null` means "may not
 * write grants at all".
 *
 * A cap table rather than a comparison of two ladders, because the two sets do
 * not line up: hub roles stop at `viewer` while tenant roles include `cashier`
 * in between, so a numeric comparison would let a hub `viewer` mint tenant
 * `cashier` — an account that can only read a hub could then ring up sales in
 * one of its branches.
 */
export const HUB_ROLE_MAX_TENANT_GRANT: Record<HubMemberRole, TenantAccessRole | null> = {
  owner: 'owner',
  admin: 'admin',
  manager: 'manager',
  viewer: null,
};

/**
 * A grant is how a member reaches one tenant of the hub, so the tenant role it
 * carries is the *effective* authority they will act with. Capping it here stops
 * a `manager` from handing out tenant `owner` — the grant would then be worth
 * more than the account that issued it.
 */
export function assertTenantRoleWithinActor(
  actor: HubActorContext,
  tenantRole: TenantAccessRole,
): void {
  if (!TENANT_ACCESS_ROLES.includes(tenantRole)) {
    throw new ValidationError(
      `tenantRole tidak valid: ${tenantRole}. Expected one of ${TENANT_ACCESS_ROLES.join(', ')}`,
    );
  }
  const cap = HUB_ROLE_MAX_TENANT_GRANT[actor.role];
  if (!cap) {
    throw new ValidationError(
      `Role hub Anda (${actor.role}) tidak bisa memberikan akses tenant`,
    );
  }
  // `TENANT_ACCESS_ROLES` is ordered widest-first, so a *smaller* index means more
  // authority: exceeding the cap means landing before it.
  if (TENANT_ACCESS_ROLES.indexOf(tenantRole) < TENANT_ACCESS_ROLES.indexOf(cap)) {
    throw new ValidationError(
      `Role hub Anda (${actor.role}) hanya bisa memberikan akses tenant sampai role ${cap}`,
    );
  }
}
