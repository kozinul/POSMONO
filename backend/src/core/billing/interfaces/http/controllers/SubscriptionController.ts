import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { SubscriptionService } from '../../../application/services/SubscriptionService';
import { EntitlementService } from '../../../application/services/EntitlementService';
import { UnauthorizedError } from '../../../../../@shared/infrastructure/error/AppError';

export class SubscriptionController extends BaseController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly entitlementService: EntitlementService,
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
    const { planId, billingCycle } = req.body;
    const sub = await this.subscriptionService.assignPlan(tenantId, planId, billingCycle);
    this.ok(res, sub.serialize());
  }

  async cancelSubscription(req: Request, res: Response): Promise<void> {
    const tenantId = req.params.tenantId;
    const sub = await this.subscriptionService.cancelSubscription(tenantId);
    this.ok(res, sub.serialize());
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
}
