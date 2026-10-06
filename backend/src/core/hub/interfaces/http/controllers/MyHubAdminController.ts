import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { NotFoundError, ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import type { PlatformAuditAction } from '../../../../../core/platform/audit/domain/PlatformAuditLog';
import type {
  AuditActor,
  PlatformAuditService,
} from '../../../../../core/platform/audit/application/services/PlatformAuditService';
import {
  HUB_ACCESS_STATUSES,
  type HubAccessStatus,
} from '../../../domain/HubMemberTenantAccess';
import {
  HUB_MEMBER_ROLES,
  HUB_MEMBERSHIP_STATUSES,
  type HubMemberRole,
} from '../../../domain/HubMembership';
import {
  assertMayAssignHubRole,
  assertMayManageMember,
  assertNotSelf,
  assertTenantRoleWithinActor,
  type HubActorContext,
  type HubMemberSummary,
} from '../../../domain/hubRoleRules';
import { HubInvitationService } from '../../../application/services/HubInvitationService';
import { HubMemberAccessService } from '../../../application/services/HubMemberAccessService';
import { HubMembershipService } from '../../../application/services/HubMembershipService';
import {
  HUB_MEMBER_ROLE_LABELS,
  TENANT_ACCESS_ROLES,
  type TenantAccessRole,
} from '../../../../platform/defaults/roles';
import type { MongoTenantRepository } from '../../../../tenant/infrastructure/persistence/MongoTenantRepository';
import type { MongoUserRepository } from '../../../../identity/infrastructure/persistence/MongoUserRepository';

/** Minimal identity surface: resolve the caller, and search within the hub. */
interface UserLike {
  id: { toValue(): string };
  displayNameValue: string;
  emailValue: string;
  isActiveValue?: boolean;
  serialize(): { id?: string; tenantId?: string; isActive?: boolean };
}

export interface MyHubAdminControllerDeps {
  membershipService: HubMembershipService;
  invitationService: HubInvitationService;
  accessService: HubMemberAccessService;
  userRepository: Pick<MongoUserRepository, 'findByIdRaw' | 'searchAcrossTenants'>;
  tenantRepository: Pick<MongoTenantRepository, 'findByHubId'>;
  auditService?: PlatformAuditService;
}

const CANDIDATE_LIMIT = 20;

/**
 * Hub V2 Fase 24 — the hub's own admin surface: members, access grants and
 * invitations, driven by hub members through `/api/hub/*`.
 *
 * Two boundaries this controller enforces that a route guard cannot:
 *
 * 1. **Ceiling, not just permission.** `hub.members.manage` is granted to
 *    `owner` and `admin`, so without `hubRoleRules` any of them could promote a
 *    peer to `owner`, suspend the last `owner`, or issue themselves tenant
 *    `owner` on a branch — authority the issuing account never had.
 * 2. **Scope of the people involved.** A user may only be added if they belong
 *    to a tenant *of this hub*, and the candidate search is scoped the same way.
 *    A hub admin must not be able to enumerate the staff of unrelated
 *    businesses just because they hold `hub.members.manage`.
 *
 * The services, the audit vocabulary and the suspend-not-delete semantics are
 * reused verbatim from the platform surface (`HubMembershipController`,
 * `HubInvitationController`); the audit trail is attributed through
 * `actor` because `req.platformUser*` is only filled by `platformAuthenticate`.
 */
export class MyHubAdminController extends BaseController {
  constructor(private readonly deps: MyHubAdminControllerDeps) {
    super();
  }

  // ------------------------------------------------------------------ members

  /**
   * Candidate users to add: active users of this hub's tenants only. The email
   * and tenant name are the minimum needed to recognise a colleague; nothing else
   * about the user is projected.
   */
  async candidates(req: Request, res: Response): Promise<void> {
    const { hubId } = req.params;
    const search = typeof req.query.search === 'string' ? req.query.search : '';

    const tenantIds = await this.hubTenantIds(hubId);
    if (tenantIds.length === 0) {
      this.ok(res, { items: [], total: 0 });
      return;
    }

    const { users, total } = await this.deps.userRepository.searchAcrossTenants(
      { search: search || undefined, tenantIds, isActive: true },
      { limit: CANDIDATE_LIMIT, skip: 0 },
    );

    const tenantNames = new Map<string, string>();
    for (const tenant of await this.deps.tenantRepository.findByHubId(hubId)) {
      const data = tenant.serialize();
      tenantNames.set(data.id, data.name);
    }

    const memberIds = await this.memberIds(hubId);

    this.ok(res, {
      items: users.map((user) => {
        const data = user.serialize();
        return {
          id: data.id ?? user.id.toValue(),
          displayName: user.displayNameValue ?? data.displayName ?? null,
          email: user.emailValue ?? data.email ?? null,
          tenantId: data.tenantId ?? null,
          tenantName: data.tenantId ? (tenantNames.get(data.tenantId) ?? null) : null,
          isMember: memberIds.has(data.id ?? user.id.toValue()),
        };
      }),
      total,
    });
  }

  async addMember(req: Request, res: Response): Promise<void> {
    const { hubId } = req.params;
    const { userId, role } = req.body ?? {};
    if (!userId) throw new ValidationError('userId is required');
    if (!HUB_MEMBER_ROLES.includes(role)) {
      throw new ValidationError(
        `Invalid role: ${role}. Expected one of ${HUB_MEMBER_ROLES.join(', ')}`,
      );
    }
    const actor = this.actor(req);
    assertMayAssignHubRole(actor, role as HubMemberRole);

    const user = (await this.deps.userRepository.findByIdRaw(userId)) as UserLike | null;
    if (!user) throw new NotFoundError('User', userId);

    const tenantId = user.serialize().tenantId;
    const tenantIds = await this.hubTenantIds(hubId);
    if (!tenantId || !tenantIds.includes(tenantId)) {
      throw new ValidationError(
        'User tersebut bukan bagian dari tenant di hub ini. Gunakan undangan untuk=user di luar hub',
      );
    }

    const membership = await this.deps.membershipService.addMembership(
      hubId,
      userId,
      role as HubMemberRole,
    );

    await this.audit(req, {
      action: 'MEMBER_ADDED',
      description: `Anggota ditambahkan ke hub dengan role ${membership.serialize().role}`,
      after: { hubId, userId, role: membership.serialize().role },
    });

    this.created(res, membership.serialize());
  }

  async updateRole(req: Request, res: Response): Promise<void> {
    const { hubId, userId } = req.params;
    const { role } = req.body ?? {};
    if (!HUB_MEMBER_ROLES.includes(role)) {
      throw new ValidationError(
        `Invalid role: ${role}. Expected one of ${HUB_MEMBER_ROLES.join(', ')}`,
      );
    }

    const target = await this.requireMember(hubId, userId);
    const actor = this.actor(req);
    assertMayManageMember(actor, target, 'mengubah role');
    assertMayAssignHubRole(actor, role as HubMemberRole);

    const nextRole = role as HubMemberRole;
    const membership = await this.deps.membershipService.updateMembershipRole(
      hubId,
      userId,
      nextRole,
    );

    await this.audit(req, {
      action: 'MEMBER_ROLE_CHANGED',
      description: `Role anggota di hub diubah menjadi ${membership.serialize().role}`,
      before: { role: target.role },
      after: { hubId, userId, role: membership.serialize().role },
    });

    this.ok(res, membership.serialize());
  }

  /**
   * One endpoint for both states, mirroring the platform route: a defaulted
   * `status` would let a malformed body silently suspend or revive somebody.
   */
  async setMemberStatus(req: Request, res: Response): Promise<void> {
    const { hubId, userId } = req.params;
    const { status } = req.body ?? {};
    if (!HUB_MEMBERSHIP_STATUSES.includes(status)) {
      throw new ValidationError(
        `status is required. Expected one of ${HUB_MEMBERSHIP_STATUSES.join(', ')}`,
      );
    }

    const target = await this.requireMember(hubId, userId);
    const actor = this.actor(req);
    const isSuspend = status === 'suspended';
    assertMayManageMember(actor, target, isSuspend ? 'menangguhkan' : 'mengaktifkan');

    const changed = isSuspend
      ? await this.deps.membershipService.suspendMembership(hubId, userId)
      : await this.deps.membershipService.reactivateMembership(hubId, userId);
    if (!changed) {
      throw new ValidationError(
        isSuspend
          ? 'Anggota tidak ditemukan atau sudah ditangguhkan'
          : 'Anggota tidak ditemukan atau sudah aktif',
      );
    }

    await this.audit(req, {
      action: isSuspend ? 'MEMBER_SUSPENDED' : 'MEMBER_REACTIVATED',
      description: isSuspend
        ? 'Anggota ditangguhkan (akses dicabut tanpa menghapus keanggotaan)'
        : 'Anggota diaktifkan kembali',
      after: { hubId, userId, status },
    });

    const membership = await this.deps.membershipService.findMembership(hubId, userId);
    this.ok(res, membership?.serialize() ?? { hubId, userId, status });
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    const { hubId, userId } = req.params;
    const target = await this.requireMember(hubId, userId);
    assertMayManageMember(this.actor(req), target, 'menghapus');

    await this.deps.membershipService.removeMembership(hubId, userId);

    await this.audit(req, {
      action: 'MEMBER_REMOVED',
      description: 'Anggota dihapus dari hub',
      before: { role: target.role },
      after: { hubId, userId },
    });

    this.noContent(res);
  }

  // ------------------------------------------------------- access grants (F17)

  async listAccess(req: Request, res: Response): Promise<void> {
    const grants = await this.deps.accessService.listGrantsForMember(
      req.params.hubId,
      req.params.userId,
    );
    this.ok(res, grants);
  }

  async replaceAccess(req: Request, res: Response): Promise<void> {
    const { hubId, userId } = req.params;
    const { tenantId, tenantRole, outletIds, status } = req.body ?? {};

    if (!tenantId) throw new ValidationError('tenantId is required');
    if (!TENANT_ACCESS_ROLES.includes(tenantRole)) {
      throw new ValidationError(
        `Invalid tenantRole: ${tenantRole}. Expected one of ${TENANT_ACCESS_ROLES.join(', ')}`,
      );
    }
    if (status !== undefined && !HUB_ACCESS_STATUSES.includes(status)) {
      throw new ValidationError(
        `Invalid status: ${status}. Expected one of ${HUB_ACCESS_STATUSES.join(', ')}`,
      );
    }
    if (outletIds !== undefined && !Array.isArray(outletIds)) {
      throw new ValidationError('outletIds must be an array of outlet ids');
    }

    const actor = this.actor(req);
    assertNotSelf(actor, userId, 'mengatur akses');
    assertTenantRoleWithinActor(actor, tenantRole as TenantAccessRole);

    const before = await this.deps.accessService
      .listGrantsForMember(hubId, userId)
      .then((rows) => rows.find((r) => r.tenantId === tenantId) ?? null);

    const grant = await this.deps.accessService.setAccess({
      hubId,
      userId,
      tenantId,
      tenantRole: tenantRole as TenantAccessRole,
      outletIds: outletIds ?? [],
      status: status as HubAccessStatus | undefined,
    });

    await this.audit(req, {
      action: before ? 'MEMBER_ACCESS_UPDATED' : 'MEMBER_ACCESS_GRANTED',
      description:
        `Akses tenant ${tenantId} untuk anggota hub ${hubId} ` +
        `${before ? 'diperbarui' : 'diberikan'} (role ${tenantRole})`,
      before: before as Record<string, unknown> | null,
      after: grant.serialize() as unknown as Record<string, unknown>,
    });

    this.ok(res, grant.serialize());
  }

  async revokeAccess(req: Request, res: Response): Promise<void> {
    const { hubId, userId, tenantId } = req.params;
    assertNotSelf(this.actor(req), userId, 'mengatur akses');

    const removed = await this.deps.accessService.revokeAccess(hubId, userId, tenantId);
    if (!removed) {
      throw new ValidationError('Access grant is already revoked');
    }

    await this.audit(req, {
      action: 'MEMBER_ACCESS_REVOKED',
      description: `Akses tenant ${tenantId} dicabut dari anggota hub ${hubId}`,
      after: { hubId, userId, tenantId },
    });

    this.noContent(res);
  }

  // --------------------------------------------------------- invitations (F20)

  async listInvitations(req: Request, res: Response): Promise<void> {
    const invitations = await this.deps.invitationService.listForHub(req.params.hubId);
    this.ok(res, invitations);
  }

  async createInvitation(req: Request, res: Response): Promise<void> {
    const { hubId } = req.params;
    const { email, role, expiresInHours } = req.body ?? {};
    if (!email) throw new ValidationError('email is required');
    if (!HUB_MEMBER_ROLES.includes(role)) {
      throw new ValidationError(
        `Invalid role: ${role}. Expected one of ${HUB_MEMBER_ROLES.join(', ')}`,
      );
    }

    const actor = this.actor(req);
    assertMayAssignHubRole(actor, role as HubMemberRole);

    const created = await this.deps.invitationService.create({
      hubId,
      email,
      role: role as HubMemberRole,
      expiresInHours,
      invitedBy: actor.userId,
    });

    await this.audit(req, {
      action: 'INVITATION_SENT',
      description: `Undangan dikirim ke ${created.invitation.email} dengan role ${created.invitation.roleLabel}`,
      // The token stays out of the audit trail on purpose — the trail is read by
      // more people than the invitee, and a token is a credential.
      after: { ...created.invitation, hubId },
    });

    this.created(res, created);
  }

  async revokeInvitation(req: Request, res: Response): Promise<void> {
    const { hubId, invitationId } = req.params;
    const invitation = await this.deps.invitationService.revoke(hubId, invitationId);
    await this.audit(req, {
      action: 'INVITATION_REVOKED',
      description: `Undangan untuk ${invitation.email} dicabut`,
      after: { ...invitation, hubId },
    });
    this.ok(res, invitation);
  }

  // ------------------------------------------------------------------ helpers

  private actor(req: Request): HubActorContext {
    const role = req.hubAccess?.role;
    if (!role || !HUB_MEMBER_ROLES.includes(role)) {
      // Only reachable if a handler is mounted without `requireHubPermission`.
      throw new ValidationError('Akses hub belum diverifikasi untuk permintaan ini');
    }
    return { userId: req.userId, role };
  }

  private async auditActor(req: Request): Promise<AuditActor> {
    const role = this.actor(req).role;
    const user = (await this.deps.userRepository.findByIdRaw(req.userId)) as UserLike | null;
    return {
      id: req.userId,
      email: user?.emailValue ?? '',
      roleName: HUB_MEMBER_ROLE_LABELS[role] ?? role,
    };
  }

  private async requireMember(
    hubId: string,
    userId: string,
  ): Promise<HubMemberSummary> {
    const membership = await this.deps.membershipService.findMembership(hubId, userId);
    if (!membership) throw new NotFoundError('HubMembership', userId);
    return { userId, role: membership.serialize().role };
  }

  private async memberIds(hubId: string): Promise<Set<string>> {
    const members = await this.deps.membershipService.listMembers(hubId);
    return new Set(members.map((m: { userId?: string }) => m.userId).filter((id): id is string => !!id));
  }

  private async hubTenantIds(hubId: string): Promise<string[]> {
    const tenants = await this.deps.tenantRepository.findByHubId(hubId);
    return tenants.map((tenant) => tenant.serialize().id);
  }

  private async audit(
    req: Request,
    payload: {
      action: PlatformAuditAction;
      description: string;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    if (!this.deps.auditService) return;
    try {
      await this.deps.auditService.recordFromRequest(req, {
        action: payload.action,
        tenantId: null,
        description: payload.description,
        before: payload.before ?? null,
        after: payload.after ?? null,
        reason: null,
        actor: await this.auditActor(req),
      });
    } catch {
      // Audit recording must never break the primary operation.
    }
  }
}
