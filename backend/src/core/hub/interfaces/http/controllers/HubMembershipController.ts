import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { PlatformAuditService } from '../../../../../core/platform/audit/application/services/PlatformAuditService';
import { HubMembershipService } from '../../../application/services/HubMembershipService';
import { HUB_MEMBER_ROLES, HubMemberRole } from '../../../domain/HubMembership';

export class HubMembershipController extends BaseController {
  constructor(
    private readonly hubMembershipService: HubMembershipService,
    private readonly auditService?: PlatformAuditService,
  ) {
    super();
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