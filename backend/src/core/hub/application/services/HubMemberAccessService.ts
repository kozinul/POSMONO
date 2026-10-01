import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../@shared/infrastructure/error/AppError';
import { HubMemberTenantAccess, type HubAccessStatus } from '../../domain/HubMemberTenantAccess';
import type { HubMemberTenantAccessRepository } from '../../domain/HubMemberTenantAccessRepository';
import { HUB_MEMBER_ROLES, type HubMemberRole } from '../../domain/HubMembership';
import type { HubMembershipRepository } from '../../domain/HubMembershipRepository';
import {
  HUB_MEMBER_ROLE_LABELS,
  HUB_MEMBER_ROLE_PERMS,
  TENANT_ACCESS_ROLES,
  TENANT_ACCESS_ROLE_LABELS,
  TENANT_ACCESS_ROLE_PERMS,
  type TenantAccessRole,
} from '../../../platform/defaults/roles';

interface HubMemberAccessServiceDeps {
  accessRepository: HubMemberTenantAccessRepository;
  hubMembershipRepository: HubMembershipRepository;
  hubRepository: any;
  tenantRepository: any;
  outletRepository?: any;
}

export interface GrantInput {
  hubId: string;
  userId: string;
  tenantId: string;
  tenantRole: TenantAccessRole;
  outletIds?: string[];
}

export interface AccessibleTenantRow {
  tenantId: string;
  tenantName: string;
  hubId: string;
  hubName: string;
  role: HubMemberRole;
  /** Present only when the tenant is reached through an explicit grant. */
  tenantRole?: TenantAccessRole;
  outletIds?: string[];
  accessSource?: 'grant' | 'fallback';
}

export type AccessSource = 'grant' | 'fallback';

export interface ResolvedTenantSession {
  tenantId: string;
  hubId: string;
  /** Hub role that gave access in fallback mode; null in grant mode. */
  hubRole: HubMemberRole | null;
  tenantRole: TenantAccessRole;
  roleName: string;
  permissions: string[];
  /** Empty = every outlet of the tenant (JWT contract). */
  outletIds: string[];
  source: AccessSource;
}

/**
 * Hub V2 Fase 17 — per-tenant access for hub members.
 *
 * Before this, a hub member's reach was implied by their *hub* role: role
 * `owner` meant full Owner permissions in **every** tenant of the hub, with
 * `outletIds: []` (= all outlets). There was no way to say "only tenant C, only
 * outlet X", so a mis-assigned member silently got owner-level access to
 * everything. This service makes reach explicit via one row per
 * (hub, user, tenant).
 *
 * Backward compatibility (ADR D3): a member with **no grant rows at all** keeps
 * the old behaviour. Once any row exists, grants are authoritative — that is the
 * switch that lets an admin narrow access without first having to write the
 * permissive baseline.
 */
export class HubMemberAccessService {
  constructor(private readonly deps: HubMemberAccessServiceDeps) {}

  // ---------------------------------------------------------------- grants

  async listGrantsForMember(hubId: string, userId: string): Promise<any[]> {
    const grants = await this.deps.accessRepository.findByHubAndUser(hubId, userId);
    return grants.map((grant) => this.decorate(grant.serialize()));
  }

  async listGrantsForUser(userId: string): Promise<any[]> {
    const grants = await this.deps.accessRepository.findByUser(userId);
    return grants.map((grant) => this.decorate(grant.serialize()));
  }

  async grantAccess(input: GrantInput): Promise<HubMemberTenantAccess> {
    await this.assertValidTarget(input.hubId, input.userId, input.tenantId, { writable: true });
    this.assertTenantRole(input.tenantRole);

    const outletIds = input.outletIds ?? [];
    await this.assertOutletsBelongToTenant(input.tenantId, outletIds);

    const existing = await this.deps.accessRepository.findByHubUserTenant(
      input.hubId,
      input.userId,
      input.tenantId,
    );
    if (existing) {
      throw new ConflictError('Access to this tenant is already granted — update it instead');
    }

    const grant = HubMemberTenantAccess.create({
      hubId: input.hubId,
      userId: input.userId,
      tenantId: input.tenantId,
      tenantRole: input.tenantRole,
      outletIds,
      status: 'active',
    });
    await this.deps.accessRepository.save(grant);
    return grant;
  }

  async updateAccess(
    hubId: string,
    userId: string,
    tenantId: string,
    input: { tenantRole?: TenantAccessRole; outletIds?: string[]; status?: HubAccessStatus },
  ): Promise<HubMemberTenantAccess> {
    const grant = await this.deps.accessRepository.findByHubUserTenant(hubId, userId, tenantId);
    if (!grant) {
      throw new NotFoundError('HubMemberTenantAccess');
    }
    await this.assertHubNotArchived(hubId);

    if (input.tenantRole !== undefined) this.assertTenantRole(input.tenantRole);
    if (input.outletIds !== undefined) {
      await this.assertOutletsBelongToTenant(tenantId, input.outletIds);
    }

    grant.updateAccess(input);
    await this.deps.accessRepository.save(grant);
    return grant;
  }

  /**
   * Upsert: the PUT behind the access modal must work for a first grant too.
   *
   * Validation runs on **both** branches. The create branch used to skip it, which
   * let a PUT grant a tenant of another hub or an outlet of another tenant — a
   * platform-admin typo that would have handed out real access.
   */
  async setAccess(input: GrantInput & { status?: HubAccessStatus }): Promise<HubMemberTenantAccess> {
    await this.assertValidTarget(input.hubId, input.userId, input.tenantId, { writable: true });
    this.assertTenantRole(input.tenantRole);
    await this.assertOutletsBelongToTenant(input.tenantId, input.outletIds ?? []);

    const existing = await this.deps.accessRepository.findByHubUserTenant(
      input.hubId,
      input.userId,
      input.tenantId,
    );
    if (!existing) {
      const grant = HubMemberTenantAccess.create({
        hubId: input.hubId,
        userId: input.userId,
        tenantId: input.tenantId,
        tenantRole: input.tenantRole,
        outletIds: input.outletIds ?? [],
        status: input.status ?? 'active',
      });
      await this.deps.accessRepository.save(grant);
      return grant;
    }

    existing.updateAccess({
      tenantRole: input.tenantRole,
      outletIds: input.outletIds,
      // A replace that omits `status` revives a suspended grant; a suspend is an
      // explicit `status` in the body, so we never silently keep someone denied.
      status: input.status ?? 'active',
    });
    await this.deps.accessRepository.save(existing);
    return existing;
  }

  async setOutlets(
    hubId: string,
    userId: string,
    tenantId: string,
    outletIds: string[],
  ): Promise<HubMemberTenantAccess> {
    return this.updateAccess(hubId, userId, tenantId, { outletIds });
  }

  /**
   * Revoke = **suspend**, never delete.
   *
   * A hard delete is not a revoke here: the moment a member's last row disappears
   * they fall back to hub-role access (ADR D3 compatibility) and silently regain
   * owner-level reach across the whole hub. Suspending keeps the row as a
   * tombstone, so "no access" survives until an admin writes a grant again.
   *
   * Returns false when there was nothing to revoke (missing or already suspended)
   * so the controller can answer 400 instead of pretending it worked.
   */
  async revokeAccess(hubId: string, userId: string, tenantId: string): Promise<boolean> {
    const grant = await this.deps.accessRepository.findByHubUserTenant(hubId, userId, tenantId);
    if (!grant) return false;
    if (!grant.isActive()) return false;

    grant.updateAccess({ status: 'suspended' });
    await this.deps.accessRepository.save(grant);
    return true;
  }

  /**
   * ADR D3: a member's baseline is "reach every tenant of the hub as viewer".
   * Called when a member is added so a brand-new member never inherits the
   * permissive hub-role fallback (role `owner` = owner in *every* tenant).
   *
   * Suspended rows are reactivated with the role they already had, so removing
   * and re-adding a member does not wipe a deliberate narrowing.
   */
  async syncDefaultGrantsForMember(hubId: string, userId: string): Promise<number> {
    const tenants = await this.deps.tenantRepository.findByHubId(hubId);
    let created = 0;

    for (const tenant of tenants) {
      const tenantId = tenant.serialize().id;
      const existing = await this.deps.accessRepository.findByHubUserTenant(hubId, userId, tenantId);

      if (existing) {
        if (!existing.isActive()) {
          existing.updateAccess({ status: 'active' });
          await this.deps.accessRepository.save(existing);
        }
        continue;
      }

      await this.deps.accessRepository.save(
        HubMemberTenantAccess.create({
          hubId,
          userId,
          tenantId,
          tenantRole: 'viewer',
          outletIds: [],
          status: 'active',
        }),
      );
      created += 1;
    }

    return created;
  }

  /** Called when a member leaves a hub so the grants cannot outlive the membership. */
  async suspendAllGrantsForMember(hubId: string, userId: string): Promise<number> {
    const grants = await this.deps.accessRepository.findByHubAndUser(hubId, userId);
    let suspended = 0;

    for (const grant of grants) {
      if (!grant.isActive()) continue;
      grant.updateAccess({ status: 'suspended' });
      await this.deps.accessRepository.save(grant);
      suspended += 1;
    }

    return suspended;
  }

  // ------------------------------------------------------- session resolution

  /**
   * Grants are authoritative when the user has at least one. This is the single
   * place that decides it, so `switchTenant` and `/auth/me` can never disagree.
   */
  async resolveSessionFor(userId: string, tenantId: string): Promise<ResolvedTenantSession | null> {
    const grants = await this.deps.accessRepository.findByUser(userId);

    if (grants.length > 0) {
      const grant = grants.find((g) => g.serialize().tenantId === tenantId);
      if (!grant) return null;

      const data = grant.serialize();
      if (!grant.isActive()) return null;
      // Defence in depth: a row must not outlive the membership or the hub it
      // was written for. `remove` suspends grants, but a hand-edited or legacy
      // row must not be a back door either.
      if (!(await this.isGrantStillLinked(data.hubId, userId, data.tenantId))) return null;

      return {
        tenantId,
        hubId: data.hubId,
        hubRole: null,
        tenantRole: data.tenantRole,
        roleName: TENANT_ACCESS_ROLE_LABELS[data.tenantRole],
        permissions: [...TENANT_ACCESS_ROLE_PERMS[data.tenantRole]],
        outletIds: [...data.outletIds],
        source: 'grant',
      };
    }

    return this.resolveFallback(userId, tenantId);
  }

  /** hub still active + user still a member + tenant still owned by that hub. */
  private async isGrantStillLinked(
    hubId: string,
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const hub = await this.deps.hubRepository.findById(hubId);
    if (!hub || !hub.isOperational()) return false;

    const membership = await this.deps.hubMembershipRepository.findByHubAndUser(hubId, userId);
    if (!membership) return false;

    const tenant = await this.deps.tenantRepository.findById(tenantId);
    if (!tenant) return false;

    return tenant.serialize().hubId === hubId;
  }

  /** ADR D3 — pre-Fase 17 behaviour: hub role decides, every outlet allowed. */
  private async resolveFallback(userId: string, tenantId: string): Promise<ResolvedTenantSession | null> {
    const memberships = await this.deps.hubMembershipRepository.findByUser(userId);

    for (const membership of memberships) {
      const membershipData = membership.serialize();
      if (!HUB_MEMBER_ROLES.includes(membershipData.role)) continue;

      const hub = await this.deps.hubRepository.findById(membershipData.hubId);
      if (!hub || !hub.isOperational()) continue;

      const tenants = await this.deps.tenantRepository.findByHubId(membershipData.hubId);
      const owns = tenants.some((t: any) => t.serialize().id === tenantId);
      if (!owns) continue;

      return {
        tenantId,
        hubId: membershipData.hubId,
        hubRole: membershipData.role,
        tenantRole: this.legacyRoleToTenantRole(membershipData.role),
        roleName: HUB_MEMBER_ROLE_LABELS[membershipData.role] ?? 'Hub Member',
        permissions: [...(HUB_MEMBER_ROLE_PERMS[membershipData.role] ?? [])],
        outletIds: [],
        source: 'fallback',
      };
    }

    return null;
  }

  private legacyRoleToTenantRole(role: HubMemberRole): TenantAccessRole {
    return role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : role === 'manager' ? 'manager' : 'viewer';
  }

  /**
   * Tenants the user may switch into. Once any grant exists the list is the
   * granted set — that is what makes a revoked tenant disappear from the
   * switcher instead of still being offered (and then 403-ing on click).
   */
  async findAccessibleTenants(userId: string): Promise<AccessibleTenantRow[]> {
    const grants = await this.deps.accessRepository.findByUser(userId);

    if (grants.length > 0) {
      return this.grantedTenants(userId, grants);
    }

    return this.fallbackTenants(userId);
  }

  private async grantedTenants(
    userId: string,
    grants: HubMemberTenantAccess[],
  ): Promise<AccessibleTenantRow[]> {
    const out: AccessibleTenantRow[] = [];

    for (const grant of grants) {
      const data = grant.serialize();
      if (!grant.isActive()) continue;

      const hub = await this.deps.hubRepository.findById(data.hubId);
      if (!hub || !hub.isOperational()) continue;

      let tenantName: string | null = null;
      let ownsTenant = false;
      try {
        const tenant = await this.deps.tenantRepository.findById(data.tenantId);
        const tenantData = tenant?.serialize();
        tenantName = tenantData?.name ?? null;
        // A grant row must still point at a tenant of its own hub; if the tenant
        // was moved to another hub the row is stale and must not be offered.
        ownsTenant = tenantData?.hubId === data.hubId;
      } catch {
        // tenant may have been deleted — keep the row out of the switcher
        continue;
      }
      if (!tenantName || !ownsTenant) continue;

      out.push({
        tenantId: data.tenantId,
        tenantName,
        hubId: data.hubId,
        hubName: hub.serialize().name,
        role: (await this.hubRoleFor(data.hubId, userId)) ?? 'viewer',
        tenantRole: data.tenantRole,
        outletIds: [...data.outletIds],
        accessSource: 'grant',
      });
    }

    return this.sortTenants(out);
  }

  private async fallbackTenants(userId: string): Promise<AccessibleTenantRow[]> {
    const memberships = await this.deps.hubMembershipRepository.findByUser(userId);
    const out: AccessibleTenantRow[] = [];

    for (const membership of memberships) {
      const data = membership.serialize();
      const hub = await this.deps.hubRepository.findById(data.hubId);
      if (!hub || !hub.isOperational()) continue;

      const tenants = await this.deps.tenantRepository.findByHubId(data.hubId);
      for (const tenant of tenants) {
        const t = tenant.serialize();
        out.push({
          tenantId: t.id,
          tenantName: t.name,
          hubId: data.hubId,
          hubName: hub.serialize().name,
          role: data.role,
          accessSource: 'fallback',
        });
      }
    }

    return this.sortTenants(out);
  }

  private sortTenants(rows: AccessibleTenantRow[]): AccessibleTenantRow[] {
    rows.sort((a, b) => {
      if (a.tenantName !== b.tenantName) return a.tenantName.localeCompare(b.tenantName);
      return a.hubName.localeCompare(b.hubName);
    });
    return rows;
  }

  private async hubRoleFor(hubId: string, userId: string): Promise<HubMemberRole | null> {
    try {
      const membership = await this.deps.hubMembershipRepository.findByHubAndUser(hubId, userId);
      return membership?.serialize().role ?? null;
    } catch {
      return null;
    }
  }

  /**
   * The union of what a user may do across every tenant they can reach — for
   * `/api/hub-context/me`. Reported per tenant as well, because a single union
   * would overstate what they can do *anywhere*.
   */
  async getContext(userId: string): Promise<{
    hubs: any[];
    grants: any[];
    tenants: AccessibleTenantRow[];
    effectivePermissions: string[];
  }> {
    const grants = await this.deps.accessRepository.findByUser(userId);
    const tenants = await this.findAccessibleTenants(userId);

    const hubIds = Array.from(
      new Set([
        ...tenants.map((t) => t.hubId),
        ...grants.map((g) => g.serialize().hubId),
      ]),
    );

    const hubs: any[] = [];
    for (const hubId of hubIds) {
      try {
        const hub = await this.deps.hubRepository.findById(hubId);
        if (!hub) continue;
        // Grants survive a suspension (that is how reactivation restores access),
        // but a hub you cannot enter must not be offered as context — it would
        // show in the switcher while granting nothing. `grants` still lists them.
        if (!hub.isOperational()) continue;
        const data = hub.serialize();
        hubs.push({
          id: hubId,
          code: data.code,
          name: data.name,
          status: data.status,
          isActive: true,
        });
      } catch {
        // hub deleted — skip
      }
    }

    const sessions = await Promise.all(
      tenants.map((t) => this.resolveSessionFor(userId, t.tenantId).catch(() => null)),
    );

    const effectivePermissions = Array.from(
      new Set(sessions.flatMap((s) => s?.permissions ?? [])),
    ).sort();

    return {
      hubs,
      grants: grants.map((g) => this.decorate(g.serialize())),
      tenants,
      effectivePermissions,
    };
  }

  // ----------------------------------------------------------------- guards

  private assertTenantRole(role: TenantAccessRole): void {
    if (!TENANT_ACCESS_ROLES.includes(role)) {
      throw new ValidationError(
        `Invalid tenant access role: ${role}. Expected one of ${TENANT_ACCESS_ROLES.join(', ')}`,
      );
    }
  }

  /** A grant must point at a live hub, a real member, and a tenant of that hub. */
  private async assertValidTarget(
    hubId: string,
    userId: string,
    tenantId: string,
    opts: { writable?: boolean } = {},
  ): Promise<void> {
    const hub = await this.deps.hubRepository.findById(hubId);
    if (!hub) throw new NotFoundError('Hub', hubId);
    if (opts.writable) this.assertHubNotArchivedRef(hub);

    const membership = await this.deps.hubMembershipRepository.findByHubAndUser(hubId, userId);
    if (!membership) {
      throw new ValidationError('User is not a member of this hub — add the member first');
    }

    const tenant = await this.deps.tenantRepository.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const tenantData = tenant.serialize();
    if (tenantData.hubId !== hubId) {
      throw new ValidationError('Tenant does not belong to this hub');
    }
  }

  private async assertOutletsBelongToTenant(tenantId: string, outletIds: string[]): Promise<void> {
    if (!outletIds || outletIds.length === 0) return;
    if (!this.deps.outletRepository?.findByTenant) return;

    const outlets = await this.deps.outletRepository.findByTenant(tenantId);
    const known = new Set(outlets.map((o: any) => o.serialize().id));
    const unknown = outletIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new ValidationError(
        `Outlet does not belong to this tenant: ${unknown.join(', ')}`,
      );
    }
  }

  /**
   * An archived hub is frozen (Fase 18): its access matrix is part of the record
   * the archive preserves. Suspending instead leaves the matrix editable while
   * still cutting every member's access.
   */
  private async assertHubNotArchived(hubId: string): Promise<void> {
    // A missing hub is not an error here: `grantAccess`/`setAccess` already
    // require the hub to exist, and `updateAccess` only needs to know that the
    // hub is not frozen. An orphaned row is unusable anyway (see
    // `isGrantStillLinked`), so refusing the edit would only strand it.
    const hub = await this.deps.hubRepository.findById(hubId);
    if (!hub) return;
    this.assertHubNotArchivedRef(hub);
  }

  private assertHubNotArchivedRef(hub: { isArchived(): boolean }): void {
    if (hub.isArchived()) {
      throw new ValidationError(
        'Hub berstatus archived tidak dapat diubah. Kembalikan statusnya ke Aktif atau Ditangguhkan terlebih dahulu.',
      );
    }
  }

  private decorate(data: ReturnType<HubMemberTenantAccess['serialize']>) {
    return {
      ...data,
      tenantRoleLabel: TENANT_ACCESS_ROLE_LABELS[data.tenantRole],
      allOutlets: data.outletIds.length === 0,
    };
  }

  /** Guards callers that must not silently proceed without an explicit grant. */
  assertSession(session: ResolvedTenantSession | null, tenantId: string): ResolvedTenantSession {
    if (!session) {
      throw new ForbiddenError('No hub access grants entry to this tenant');
    }
    if (session.tenantId !== tenantId) {
      throw new ForbiddenError('No hub access grants entry to this tenant');
    }
    return session;
  }
}
