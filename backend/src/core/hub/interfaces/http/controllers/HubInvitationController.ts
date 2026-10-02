import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { PlatformAuditService } from '../../../../../core/platform/audit/application/services/PlatformAuditService';
import type { PlatformAuditAction } from '../../../../../core/platform/audit/domain/PlatformAuditLog';
import { HubInvitationService } from '../../../application/services/HubInvitationService';
import { HUB_MEMBER_ROLES, type HubMemberRole } from '../../../domain/HubMembership';

/**
 * Hub V2 Fase 20 — invitations.
 *
 * Two audiences, two routes, one service: the platform admin issues and revokes
 * (`platform.hubs.manage`), and the invited user previews and accepts their own
 * invitation with a normal tenant session (`authenticate`). The accept path never
 * accepts a hubId, email or role from the body — everything comes from the
 * invitation row, so a caller cannot join a hub of their choosing.
 */
export class HubInvitationController extends BaseController {
  constructor(
    private readonly hubInvitationService: HubInvitationService,
    private readonly auditService?: PlatformAuditService,
  ) {
    super();
  }

  // ------------------------------------------------- platform administration

  async create(req: Request, res: Response): Promise<void> {
    const { email, role, expiresInHours } = req.body ?? {};
    if (!email) throw new ValidationError('email is required');
    if (!role) throw new ValidationError('role is required');
    if (!HUB_MEMBER_ROLES.includes(role)) {
      throw new ValidationError(
        `Invalid role: ${role}. Expected one of ${HUB_MEMBER_ROLES.join(', ')}`,
      );
    }

    const created = await this.hubInvitationService.create({
      hubId: req.params.hubId,
      email,
      role: role as HubMemberRole,
      expiresInHours,
      invitedBy: req.platformUserId ?? '',
    });

    await this.audit(req, {
      action: 'INVITATION_SENT',
      description: `Undangan dikirim ke ${created.invitation.email} dengan role ${created.invitation.roleLabel}`,
      // The token is deliberately absent: the audit trail is readable by more
      // people than the invitee, and must not become a second copy of the secret.
      after: { ...created.invitation, hubId: req.params.hubId },
    });

    // 201, and the raw token exactly once — the UI puts it on the clipboard.
    this.created(res, created);
  }

  async list(req: Request, res: Response): Promise<void> {
    const invitations = await this.hubInvitationService.listForHub(req.params.hubId);
    this.ok(res, invitations);
  }

  async revoke(req: Request, res: Response): Promise<void> {
    const { hubId, invitationId } = req.params;
    const invitation = await this.hubInvitationService.revoke(hubId, invitationId);
    await this.audit(req, {
      action: 'INVITATION_REVOKED',
      description: `Undangan untuk ${invitation.email} dicabut`,
      after: { ...invitation, hubId },
    });
    this.ok(res, invitation);
  }

  // ------------------------------------------------------------ invitee side

  async preview(req: Request, res: Response): Promise<void> {
    const preview = await this.hubInvitationService.preview(req.params.token, req.userId);
    this.ok(res, preview);
  }

  async accept(req: Request, res: Response): Promise<void> {
    const result = await this.hubInvitationService.accept(req.params.token, req.userId);
    await this.audit(req, {
      action: 'INVITATION_ACCEPTED',
      description:
        `Undangan hub ${result.hubName} diterima` +
        `${result.created ? '' : ' (anggota sudah ada sebelumnya)'}`,
      after: { hubId: result.hubId, userId: req.userId, role: result.membership.role },
    });
    this.ok(res, result);
  }

  private async audit(
    req: Request,
    payload: {
      action: PlatformAuditAction;
      description: string;
      after?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.recordFromRequest(req, {
        action: payload.action,
        tenantId: null,
        description: payload.description,
        before: null,
        after: payload.after ?? null,
        reason: null,
      });
    } catch {
      // Audit recording must never break the primary operation.
    }
  }
}
