import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../@shared/infrastructure/error/AppError';
import { Hub } from '../../domain/Hub';
import { HubMembership, HUB_MEMBER_ROLES, HubMemberRole } from '../../domain/HubMembership';
import { HubMembershipRepository } from '../../domain/HubMembershipRepository';
import { HubRepository } from '../../domain/HubRepository';

interface HubMembershipServiceDeps {
  hubMembershipRepository: HubMembershipRepository;
  hubRepository: HubRepository;
  tenantRepository: any;
  userRepository: any;
  /**
   * Hub V2 Fase 17 — per-tenant grants. When wired, the reachable tenant set is
   * narrowed by the member's grants; when absent the pre-Fase 17 behaviour
   * (every tenant of an active hub) is kept, so a partially deployed instance
   * does not lock members out.
   */
  accessService?: any;
}

export interface AccessibleTenant {
  tenantId: string;
  tenantName: string;
  hubId: string;
  hubName: string;
  role: HubMemberRole;
}

export class HubMembershipService {
  constructor(private readonly deps: HubMembershipServiceDeps) {}

  async addMembership(hubId: string, userId: string, role: HubMemberRole): Promise<HubMembership> {
    if (!HUB_MEMBER_ROLES.includes(role)) {
      throw new ValidationError(`Invalid hub member role: ${role}. Expected one of ${HUB_MEMBER_ROLES.join(', ')}`);
    }

    const hub = await this.deps.hubRepository.findById(hubId);
    if (!hub) {
      throw new NotFoundError('Hub', hubId);
    }
    this.assertHubNotArchivedRef(hub);

    const user = await this.deps.userRepository.findByIdRaw(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const existing = await this.deps.hubMembershipRepository.findByHubAndUser(hubId, userId);
    const membership = existing ?? HubMembership.create({ hubId, userId, role });

    if (existing) {
      // Fase 20: a suspension is a tombstone, not a removal, so re-adding a
      // suspended member **reactivates** it instead of failing as a duplicate.
      // Refusing would leave no way back from a suspension other than a dedicated
      // reactivation call, and "add this person" is what an admin actually clicks.
      if (existing.isActive()) {
        throw new ConflictError('User is already a member of this hub');
      }
      existing.reactivate();
      // The role comes from the caller's form: for an invitation accept it is the
      // role the invitation was issued with, and a stale `viewer` from before the
      // suspension would silently not be what was invited.
      existing.updateRole(role);
      await this.deps.hubMembershipRepository.save(existing);
    } else {
      await this.deps.hubMembershipRepository.save(membership);
    }

    // ADR D3: a new member's baseline is "reach every tenant of the hub as
    // viewer". Seeding it here is what stops a member with hub role `owner` from
    // inheriting the permissive fallback and becoming Owner in every tenant.
    // It also revives grants that were suspended when the member left, keeping
    // their stored role and outlet scope (Fase 17 decision).
    // Best-effort: a failure must not undo the membership the admin just created.
    if (this.deps.accessService?.syncDefaultGrantsForMember) {
      try {
        await this.deps.accessService.syncDefaultGrantsForMember(hubId, userId);
      } catch {
        // grant baseline is repaired from the Access UI
      }
    }

    return membership;
  }

  async findMembership(hubId: string, userId: string): Promise<HubMembership | null> {
    return this.deps.hubMembershipRepository.findByHubAndUser(hubId, userId);
  }

  /**
   * Hub V2 Fase 20 — pause a member without losing the record of them.
   *
   * Removing the row is not an acceptable substitute: it drops the user back into
   * the ADR D3 zero-grant fallback, which restores hub-wide `owner`-like access
   * instead of cutting it. A suspension keeps the row and simply fails the
   * "active membership" gate every access path checks.
   *
   * The grants are deliberately left alone. They describe the *shape* of the
   * access; the membership decides whether any of it applies. That way
   * `reactivate` restores exactly the matrix that was in force before, with no
   * second write path that could drift.
   *
   * Returns false when there was nothing to suspend (unknown or already
   * suspended) so the controller can answer 400 instead of pretending.
   */
  async suspendMembership(hubId: string, userId: string): Promise<boolean> {
    const membership = await this.deps.hubMembershipRepository.findByHubAndUser(hubId, userId);
    if (!membership) return false;
    await this.assertHubNotArchived(hubId);
    if (!membership.isActive()) return false;

    membership.suspend();
    await this.deps.hubMembershipRepository.save(membership);
    return true;
  }

  /** Undo a suspension. The stored role and grants are kept, so access returns as it was. */
  async reactivateMembership(hubId: string, userId: string): Promise<boolean> {
    const membership = await this.deps.hubMembershipRepository.findByHubAndUser(hubId, userId);
    if (!membership) return false;
    await this.assertHubNotArchived(hubId);
    if (membership.isActive()) return false;

    membership.reactivate();
    await this.deps.hubMembershipRepository.save(membership);
    return true;
  }

  async updateMembershipRole(hubId: string, userId: string, role: HubMemberRole): Promise<HubMembership> {
    if (!HUB_MEMBER_ROLES.includes(role)) {
      throw new ValidationError(`Invalid hub member role: ${role}. Expected one of ${HUB_MEMBER_ROLES.join(', ')}`);
    }

    const membership = await this.deps.hubMembershipRepository.findByHubAndUser(hubId, userId);
    if (!membership) {
      throw new NotFoundError('HubMembership');
    }
    await this.assertHubNotArchived(hubId);

    membership.updateRole(role);
    await this.deps.hubMembershipRepository.save(membership);
    return membership;
  }

  async removeMembership(hubId: string, userId: string): Promise<void> {
    await this.assertHubNotArchived(hubId);

    const deleted = await this.deps.hubMembershipRepository.deleteByHubAndUser(hubId, userId);
    if (!deleted) {
      throw new NotFoundError('HubMembership');
    }

    // Suspend (never delete) the grants: rows left active would keep granting
    // access to a user who is no longer a member of this hub.
    if (this.deps.accessService?.suspendAllGrantsForMember) {
      try {
        await this.deps.accessService.suspendAllGrantsForMember(hubId, userId);
      } catch {
        // resolution re-checks the membership, so a stale row cannot be used
      }
    }
  }

  async listMembers(hubId: string): Promise<any[]> {
    const hub = await this.deps.hubRepository.findById(hubId);
    if (!hub) {
      throw new NotFoundError('Hub', hubId);
    }

    const memberships = await this.deps.hubMembershipRepository.findByHub(hubId);
    const members = await Promise.all(
      memberships.map(async (membership) => {
        const data = membership.serialize();
        let user: any = null;
        try {
          user = await this.deps.userRepository.findByIdRaw(data.userId);
        } catch {
          // best-effort user decoration
        }
        return {
          ...data,
          displayName: user?.displayNameValue ?? user?.serialize()?.displayName ?? null,
          email: user?.emailValue ?? user?.serialize()?.email ?? null,
          userTenantId: user?.serialize()?.tenantId ?? null,
        };
      }),
    );

    // One tenant lookup per distinct tenant, not per member.
    const tenantNames = new Map<string, string>();
    const tenantIds = [
      ...new Set(
        members
          .map((m) => m.userTenantId as string)
          .filter((id): id is string => !!id),
      ),
    ];
    for (const tenantId of tenantIds) {
      try {
        const tenant = await this.deps.tenantRepository.findById(tenantId);
        const name = tenant?.serialize()?.name;
        if (name) tenantNames.set(tenantId, name);
      } catch {
        // best-effort tenant name decoration
      }
    }

    return members.map((member) => ({
      ...member,
      userTenantName: member.userTenantId ? tenantNames.get(member.userTenantId) ?? null : null,
    }));
  }

  async listByUser(userId: string): Promise<any[]> {
    const memberships = await this.deps.hubMembershipRepository.findByUser(userId);
    return Promise.all(
      memberships.map(async (membership) => {
        const data = membership.serialize();
        let hub: Hub | null = null;
        try {
          hub = await this.deps.hubRepository.findById(data.hubId);
        } catch {
          // best-effort hub decoration
        }
        return { ...data, hubName: hub?.serialize().name ?? null };
      }),
    );
  }

  async findAccessibleTenants(userId: string): Promise<AccessibleTenant[]> {
    if (this.deps.accessService) {
      return this.deps.accessService.findAccessibleTenants(userId);
    }

    const memberships = await this.deps.hubMembershipRepository.findByUser(userId);

    const out: AccessibleTenant[] = [];
    for (const membership of memberships) {
      const data = membership.serialize();
      // Fase 20: a suspended member reaches nothing. The grant path enforces
      // this in `HubMemberAccessService`; this is the pre-Fase-17 fallback.
      if (!membership.isActive()) continue;
      const hub = await this.deps.hubRepository.findById(data.hubId);
      if (!hub || !hub.isOperational()) continue;
      const hubName = hub.serialize().name;

      const tenants = await this.deps.tenantRepository.findByHubId(data.hubId);
      for (const tenant of tenants) {
        const t = tenant.serialize();
        out.push({
          tenantId: t.id,
          tenantName: t.name,
          hubId: data.hubId,
          hubName,
          role: data.role,
        });
      }
    }

    out.sort((a, b) => {
      if (a.tenantName !== b.tenantName) return a.tenantName.localeCompare(b.tenantName);
      return a.hubName.localeCompare(b.hubName);
    });
    return out;
  }

  async resolveRoleForTenant(userId: string, tenantId: string): Promise<HubMemberRole | null> {
    const accessible = await this.findAccessibleTenants(userId);
    const target = accessible.find((t) => t.tenantId === tenantId);
    return target?.role ?? null;
  }

  /**
   * An archived hub is a tombstone (Fase 18): its membership is frozen, because
   * the record of who was in the group at the time is part of what archiving
   * preserves. Revoking access still works on a suspended hub — that is the
   * cheaper lever than deleting rows.
   */
  private async assertHubNotArchived(hubId: string): Promise<void> {
    const hub = await this.deps.hubRepository.findById(hubId);
    if (!hub) return;
    this.assertHubNotArchivedRef(hub);
  }

  /** Synchronous variant for call sites that already hold the hub. */
  private assertHubNotArchivedRef(hub: Hub): void {
    if (hub.isArchived()) {
      throw new ValidationError(
        'Hub berstatus archived tidak dapat diubah. Kembalikan statusnya ke Aktif atau Ditangguhkan terlebih dahulu.',
      );
    }
  }
}