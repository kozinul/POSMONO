import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { PlatformAuditService } from '../../../../../core/platform/audit/application/services/PlatformAuditService';
import { HubMembershipService } from '../../../application/services/HubMembershipService';
import { HubMemberAccessService } from '../../../application/services/HubMemberAccessService';
import { HUB_MEMBER_ROLES, HubMemberRole } from '../../../domain/HubMembership';
import { HUB_ACCESS_STATUSES, type HubAccessStatus } from '../../../domain/HubMemberTenantAccess';
import { TENANT_ACCESS_ROLES, type TenantAccessRole } from '../../../../platform/defaults/roles';

export class HubMembershipController extends BaseController {
  constructor(
    private readonly hubMembershipService: HubMembershipService,
    private readonly auditService?: PlatformAuditService,
    /**
     * Hub V2 Fase 17 — per-tenant access grants. Optional so the membership
     * endpoints keep working on an instance that has not run the migration.
     */
    private readonly hubMemberAccessService?: HubMemberAccessService,
  ) {
    super();
  }

  private requireAccessService(): HubMemberAccessService {
    if (!this.hubMemberAccessService) {
      throw new ValidationError('Hub member access is not configured on this instance');
    }
    return this.hubMemberAccessService;
  }

  async add(req: Request, res: Response): Promise<void> {
    const { hubId, userId, role } = req.body;
    if (!hubId || !userId) {
      throw new ValidationError('hubId and userId are required');
    }
    const membership = await this.hubMembershipService.addMembership(hubId, userId, role);
    await this.audit(req, {
      action: 'MEMBER_ADDED',
      description: `Anggota ditambahkan ke hub dengan role ${membership.serialize().role}`,
      after: { hubId, userId, role: membership.serialize().role },
    });
    this.created(res, membership.serialize());
  }

  async updateRole(req: Request, res: Response): Promise<void> {
    const { role } = req.body;
    const membership = await this.hubMembershipService.updateMembershipRole(
      req.params.hubId,
      req.params.userId,
      role,
    );
    await this.audit(req, {
      action: 'MEMBER_ROLE_CHANGED',
      description: `Role anggota di hub diubah menjadi ${membership.serialize().role}`,
      after: { hubId: req.params.hubId, userId: req.params.userId, role: membership.serialize().role },
    });
    this.ok(res, membership.serialize());
  }

  async remove(req: Request, res: Response): Promise<void> {
    await this.hubMembershipService.removeMembership(req.params.hubId, req.params.userId);
    await this.audit(req, {
      action: 'MEMBER_REMOVED',
      description: 'Anggota dihapus dari hub',
      after: { hubId: req.params.hubId, userId: req.params.userId },
    });
    this.noContent(res);
  }

  async listMembers(req: Request, res: Response): Promise<void> {
    const members = await this.hubMembershipService.listMembers(req.params.hubId);
    this.ok(res, members);
  }

  async myMemberships(req: Request, res: Response): Promise<void> {
    const memberships = await this.hubMembershipService.listByUser(req.userId);
    this.ok(res, memberships);
  }

  async myAccessibleTenants(req: Request, res: Response): Promise<void> {
    const tenants = await this.hubMembershipService.findAccessibleTenants(req.userId);
    this.ok(res, tenants);
  }

  // ------------------------------------------- Hub V2 Fase 17: access grants

  async listAccess(req: Request, res: Response): Promise<void> {
    const grants = await this.requireAccessService().listGrantsForMember(
      req.params.hubId,
      req.params.userId,
    );
    this.ok(res, grants);
  }

  async replaceAccess(req: Request, res: Response): Promise<void> {
    const { hubId, userId } = req.params;
    const { tenantId, tenantRole, outletIds, status } = req.body ?? {};

    if (!tenantId) throw new ValidationError('tenantId is required');
    if (!tenantRole) throw new ValidationError('tenantRole is required');
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

    const before = await this.requireAccessService()
      .listGrantsForMember(hubId, userId)
      .then((rows) => rows.find((r: any) => r.tenantId === tenantId) ?? null);

    const grant = await this.requireAccessService().setAccess({
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
        `${before ? 'diperbarui' : 'diberikan'} (role ${tenantRole}, ` +
        `${(outletIds ?? []).length === 0 ? 'semua outlet' : `${(outletIds ?? []).length} outlet`})`,
      before: before as Record<string, unknown> | null,
      after: grant.serialize() as unknown as Record<string, unknown>,
    });

    this.ok(res, grant.serialize());
  }

  async revokeAccess(req: Request, res: Response): Promise<void> {
    const { hubId, userId, tenantId } = req.params;
    const removed = await this.requireAccessService().revokeAccess(hubId, userId, tenantId);
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

  /** `GET /api/hub-context/me` — what this member can actually reach. */
  async myContext(req: Request, res: Response): Promise<void> {
    const context = await this.requireAccessService().getContext(req.userId);
    this.ok(res, context);
  }

  private async audit(
    req: Request,
    payload: {
      action: any;
      tenantId?: string | null;
      description: string;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      reason?: string | null;
    },
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.recordFromRequest(req, {
        action: payload.action,
        tenantId: payload.tenantId ?? null,
        description: payload.description,
        before: payload.before ?? null,
        after: payload.after ?? null,
        reason: payload.reason ?? null,
      });
    } catch {
      // Audit recording must never break the primary operation.
    }
  }
}