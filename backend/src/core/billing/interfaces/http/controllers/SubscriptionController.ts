import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { SubscriptionService } from '../../../application/services/SubscriptionService';
import { SubscriptionBillingService } from '../../../application/services/SubscriptionBillingService';
import { EntitlementService } from '../../../application/services/EntitlementService';
import { UnauthorizedError, ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import { PlatformAuditService } from '../../../../../core/platform/audit/application/services/PlatformAuditService';

export class SubscriptionController extends BaseController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly entitlementService: EntitlementService,
    private readonly auditService?: PlatformAuditService,
    private readonly billingService?: SubscriptionBillingService,
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

    // Invoice issued AFTER the mutation succeeded — a failed invoice write must
    // never roll back the plan assignment (best-effort, like the ledger).
    const s = sub.serialize();
    await this.tryBilling(async () => {
      await this.billingService?.createInvoiceForPlan({
        tenantId,
        subscriptionId: s.id,
        planId: s.planId,
        referenceType: before ? 'plan_changed' : 'plan_assigned',
        periodStart: s.currentPeriodStart,
        periodEnd: s.currentPeriodEnd,
      });
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
    if (sub) {
      const s = sub.serialize();
      await this.tryBilling(async () => {
        await this.billingService?.createInvoiceForExtend({
          tenantId,
          subscriptionId: s.id,
          planId: s.planId,
          referenceType: 'extended',
          periodStart: new Date(s.currentPeriodEnd.getTime() - days * 86_400_000),
          periodEnd: s.currentPeriodEnd,
          days,
        });
      });
    }
    this.ok(res, sub ? sub.serialize() : { subscription: null });
  }

  async getSubscriptionHistory(req: Request, res: Response): Promise<void> {
    const tenantId = req.params.tenantId;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const history = await this.subscriptionService.getTenantSubscriptionHistory(
      tenantId,
      isNaN(limit) ? 100 : limit,
    );
    this.ok(res, { items: history, total: history.length });
  }

  async getTenantEntitlement(req: Request, res: Response): Promise<void> {
    const tenantId = req.params.tenantId;
    const entitlement = await this.entitlementService.getTenantEntitlement(tenantId);
    this.ok(res, entitlement);
  }

  async listTenantInvoices(req: Request, res: Response): Promise<void> {
    const tenantId = req.params.tenantId;
    if (!this.billingService) {
      this.ok(res, { items: [], totals: { outstanding: 0, paid: 0 } });
      return;
    }
    const result = await this.billingService.listInvoices(tenantId);
    this.ok(res, result);
  }

  async listTenantInvoicePayments(req: Request, res: Response): Promise<void> {
    const { tenantId, invoiceId } = req.params;
    if (!this.billingService) {
      this.ok(res, { items: [] });
      return;
    }
    const result = await this.billingService.listPaymentAttempts(tenantId, invoiceId);
    this.ok(res, result);
  }

  async recordInvoicePayment(req: Request, res: Response): Promise<void> {
    const { tenantId, invoiceId } = req.params;
    const { amount, method, referenceNumber, notes } = req.body || {};
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new ValidationError('Nominal pembayaran valid harus disertakan.');
    }
    if (!method || typeof method !== 'string') {
      throw new ValidationError('Metode pembayaran harus disertakan.');
    }
    if (!this.billingService) {
      throw new ValidationError('Layanan billing tidak tersedia.');
    }
    const actorEmail = (req as any).platformUserEmail || 'system';
    const result = await this.billingService.recordPaymentAttempt({
      tenantId,
      invoiceId,
      amount: numAmount,
      method,
      referenceNumber,
      notes,
      actorEmail,
    });
    await this.audit(req, {
      action: 'SUBSCRIPTION_INVOICE_PAID',
      tenantId,
      description: `Pembayaran invoice ${result.invoice.number} sebesar Rp ${numAmount.toLocaleString('id-ID')} dicatat`,
      after: {
        invoiceId,
        invoiceNumber: result.invoice.number,
        amount: numAmount,
        method,
        referenceNumber: referenceNumber ?? null,
      },
      reason: notes ?? null,
    });
    this.ok(res, result);
  }

  async cancelInvoice(req: Request, res: Response): Promise<void> {
    const { tenantId, invoiceId } = req.params;
    const reason = req.body?.reason ?? null;
    if (!this.billingService) {
      throw new ValidationError('Layanan billing tidak tersedia.');
    }
    const result = await this.billingService.cancelInvoice(tenantId, invoiceId, reason);
    await this.audit(req, {
      action: 'SUBSCRIPTION_INVOICE_CANCELLED',
      tenantId,
      description: `Invoice ${result.invoice.number} dibatalkan`,
      after: {
        invoiceId,
        invoiceNumber: result.invoice.number,
        status: result.invoice.status,
      },
      reason,
    });
    this.ok(res, result);
  }

  // Merchant Portal endpoints
  async getCurrentEntitlement(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedError('Unauthorized');
    }
    const entitlement = await this.entitlementService.getTenantEntitlement(tenantId);
    this.ok(res, entitlement);
  }

  async getCurrentInvoices(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedError('Unauthorized');
    }
    if (!this.billingService) {
      this.ok(res, { items: [], totals: { outstanding: 0, paid: 0 } });
      return;
    }
    const result = await this.billingService.listInvoices(tenantId);
    this.ok(res, result);
  }

  async getCurrentPayments(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedError('Unauthorized');
    }
    if (!this.billingService) {
      this.ok(res, { items: [] });
      return;
    }
    const { items } = await this.billingService.listPaymentAttempts(tenantId);
    this.ok(res, { items: items.filter((a) => a.status === 'completed') });
  }

  async getCurrentHistory(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedError('Unauthorized');
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const history = await this.subscriptionService.getTenantSubscriptionHistory(
      tenantId,
      isNaN(limit) ? 100 : limit,
    );
    this.ok(res, { items: history, total: history.length });
  }

  async renewSubscription(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedError('Unauthorized');
    }
    const days = req.body?.days ? parseInt(req.body.days, 10) : 30;
    const numDays = isNaN(days) || days <= 0 ? 30 : days;
    if (!this.billingService) {
      throw new ValidationError('Layanan billing tidak tersedia.');
    }

    const { subscription, plan } = await this.subscriptionService.getTenantSubscription(tenantId);
    if (!subscription || !plan) {
      throw new ValidationError('Tenant tidak memiliki langganan aktif untuk diperpanjang.');
    }
    if (plan.basePrice <= 0) {
      throw new ValidationError('Plan gratis tidak memerlukan perpanjangan.');
    }

    const baseDate = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : new Date();
    const periodStart = baseDate.getTime() > Date.now() ? baseDate : new Date();
    const periodEnd = new Date(periodStart.getTime() + numDays * 86_400_000);

    const invoice = await this.billingService.createInvoiceForExtend({
      tenantId,
      subscriptionId: subscription.id,
      planId: subscription.planId,
      referenceType: 'renewal',
      periodStart,
      periodEnd,
      days: numDays,
      notes: 'Perpanjangan mandiri (merchant)',
    });

    if (!invoice) {
      throw new ValidationError('Gagal membuat invoice perpanjangan.');
    }

    this.ok(res, { invoice: invoice.serialize() });
  }

  async payCurrentInvoice(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedError('Unauthorized');
    }
    const { invoiceId } = req.params;
    const { amount, method, referenceNumber, notes } = req.body || {};
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new ValidationError('Nominal pembayaran valid harus disertakan.');
    }
    if (!method || typeof method !== 'string') {
      throw new ValidationError('Metode pembayaran harus disertakan.');
    }
    if (!this.billingService) {
      throw new ValidationError('Layanan billing tidak tersedia.');
    }
    const actorEmail = (req as any).userEmail || (req as any).platformUserEmail || 'merchant';
    const result = await this.billingService.recordPaymentAttempt({
      tenantId,
      invoiceId,
      amount: numAmount,
      method,
      referenceNumber,
      notes,
      actorEmail,
    });
    this.ok(res, result);
  }

  private async safeGetSubscription(tenantId: string): Promise<any | null> {
    try {
      const { subscription } = await this.subscriptionService.getTenantSubscription(tenantId);
      return subscription;
    } catch {
      return null;
    }
  }

  private async tryBilling(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch {
      // Invoice creation is best-effort (see MEMBER_AREA_PLAN.md): a failed
      // invoice write must never break the subscription mutation.
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