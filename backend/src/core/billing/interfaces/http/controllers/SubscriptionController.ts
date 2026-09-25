import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { SubscriptionService } from '../../../application/services/SubscriptionService';
import { EntitlementService } from '../../../application/services/EntitlementService';
import { UnauthorizedError, ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { PlatformAuditService } from '../../../../../core/platform/audit/application/services/PlatformAuditService';

export class SubscriptionController extends BaseController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly entitlementService: EntitlementService,
    private readonly auditService?: PlatformAuditService,
  ) {
    super();
  }

  async getTenantSubscription(req: Request, res: Response): Promise<void> {
    const tenantId = req.params.tenantId;
    const result = await this.subscriptionService.getTenantSubscription(tenantId);
    this.ok(res, result);
  }

  async assignPlan(req: Request, res: Response): Promise<void> {
    const tenantId = req.params.tenantId;
    const { planId, billingCycle, reason } = req.body;
    const before = await this.safeGetSubscription(tenantId);
    const sub = await this.subscriptionService.assignPlan(tenantId, planId, billingCycle, {
      actorEmail: (req as any).platformUserEmail || 'system',
      reason,
    });
    await this.audit(req, {
      action: before ? 'PLAN_CHANGED' : 'PLAN_ASSIGNED',
      tenantId,
      description: `Plan tenant ${before ? 'diubah' : 'di-assign'} ke ${sub.serialize().planId}`,
      before: before
        ? {
            planId: before.planId,
            status: before.status,
            periodEnd: before.currentPeriodEnd,
          }
        : null,
      after: {
        planId: sub.serialize().planId,
        billingCycle: sub.serialize().billingCycle,
        status: sub.serialize().status,
        periodEnd: sub.serialize().currentPeriodEnd,
      },
      reason,
    });
    this.ok(res, sub.serialize());
  }

  async cancelSubscription(req: Request, res: Response): Promise<void> {
    const tenantId = req.params.tenantId;
    const reason = req.body?.reason;
    const sub = await this.subscriptionService.cancelSubscription(tenantId, reason, {
      actorEmail: (req as any).platformUserEmail || 'system',
      reason,
    });
    await this.audit(req, {
      action: 'PLAN_CANCELLED',
      tenantId,
      description: 'Subscription tenant dibatalkan',
      before: {
        planId: sub.serialize().planId,
        status: sub.serialize().status,
      },
      after: {
        status: sub.serialize().status,
        cancelledAt: sub.serialize().cancelledAt,
      },
      reason,
    });
    this.ok(res, sub.serialize());
  }

  async extendSubscription(req: Request, res: Response): Promise<void> {
    const tenantId = req.params.tenantId;
    const days = parseInt(req.body.days, 10);
    if (isNaN(days) || days <= 0) {
      throw new ValidationError('Valid positive number of days is required');
    }
    const sub = await this.subscriptionService.extendSubscription(tenantId, days, {
      actorEmail: (req as any).platformUserEmail || 'system',
      reason: req.body.reason,
    });
    this.ok(res, sub ? sub.serialize() : { subscription: null });
  }

  async getSubscriptionHistory(req: Request, res: Response): Promise<void> {
    const tenantId = req.params.tenantId;
    const history = await this.subscriptionService.getTenantSubscriptionHistory(tenantId);
    this.ok(res, { items: history, total: history.length });
  }

  async getTenantEntitlement(req: Request, res: Response): Promise<void> {
    const tenantId = req.params.tenantId;
    const entitlement = await this.entitlementService.getTenantEntitlement(tenantId);
    this.ok(res, entitlement);
  }

  // Merchant Portal endpoint
  async getCurrentEntitlement(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedError('Unauthorized');
    }
    const entitlement = await this.entitlementService.getTenantEntitlement(tenantId);
    this.ok(res, entitlement);
  }

  private async safeGetSubscription(tenantId: string): Promise<any | null> {
    try {
      const { subscription } = await this.subscriptionService.getTenantSubscription(tenantId);
      return subscription;
    } catch {
      return null;
    }
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