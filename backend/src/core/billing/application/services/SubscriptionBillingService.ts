import { SubscriptionInvoice, ISubscriptionInvoice } from '../../domain/SubscriptionInvoice';
import { PaymentAttempt, IPaymentAttempt } from '../../domain/PaymentAttempt';
import { MongoSubscriptionInvoiceRepository } from '../../infrastructure/persistence/MongoSubscriptionInvoiceRepository';
import { MongoPaymentAttemptRepository } from '../../infrastructure/persistence/MongoPaymentAttemptRepository';
import { MongoPlanRepository } from '../../infrastructure/persistence/MongoPlanRepository';
import { SubscriptionService } from './SubscriptionService';
import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';

/**
 * Subscription billing: durable invoices + payment attempts, deliberately kept
 * OUT of `SubscriptionService` (whose 4-position constructor is at the edge of
 * the named-deps rule). One aggregate at a time, `settlePayment` is the only
 * place where "money received" becomes "service extended", which is also where
 * the future wallet/auto-renewal debit plugs in — see
 * `docs/MEMBER_AREA_PLAN.md` (`SubscriptionBillingService.settlePayment`).
 */
export interface SubscriptionBillingServiceDeps {
  invoiceRepository: MongoSubscriptionInvoiceRepository;
  paymentAttemptRepository: MongoPaymentAttemptRepository;
  planRepository: MongoPlanRepository;
  subscriptionService: SubscriptionService;
}

export class SubscriptionBillingService {
  constructor(private readonly deps: SubscriptionBillingServiceDeps) {}

  /**
   * Invoice after a platform assign/change. Best-effort: a failed invoice write
   * (or a plan without a price) must never roll the subscription mutation back.
   */
  async createInvoiceForPlan(args: {
    tenantId: string;
    subscriptionId: string | null;
    planId: string;
    referenceType: 'plan_assigned' | 'plan_changed';
    periodStart: Date;
    periodEnd: Date;
  }): Promise<SubscriptionInvoice | null> {
    const plan = await this.deps.planRepository.findById(args.planId);
    if (!plan) return null;
    const p = plan.serialize();
    if (p.basePrice <= 0) return null;

    const invoice = SubscriptionInvoice.create({
      tenantId: args.tenantId,
      subscriptionId: args.subscriptionId,
      number: await this.deps.invoiceRepository.nextNumber(args.tenantId),
      amount: p.basePrice,
      currency: 'IDR',
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      dueDate: args.periodEnd,
      lineItems: [
        { description: `Plan ${p.name}`, amount: p.basePrice, quantity: 1, total: p.basePrice },
      ],
      referenceType: args.referenceType,
      notes: null,
    });
    return this.createWithRetry(invoice);
  }

  /**
   * Invoice for an extension. `referenceType === 'renewal'` is the
   * invoice-first merchant path (settling extends the subscription);
   * `'extended'` is the platform admin path (money already received offline,
   * settling merely marks the invoice paid).
   */
  async createInvoiceForExtend(args: {
    tenantId: string;
    subscriptionId: string | null;
    planId: string;
    referenceType: 'renewal' | 'extended';
    periodStart: Date;
    periodEnd: Date;
    days: number;
    notes?: string | null;
  }): Promise<SubscriptionInvoice | null> {
    const plan = await this.deps.planRepository.findById(args.planId);
    if (!plan) return null;
    const p = plan.serialize();
    if (p.basePrice <= 0) return null;

    const amount = Math.round((p.basePrice * args.days) / 30);
    if (amount <= 0) return null;

    const invoice = SubscriptionInvoice.create({
      tenantId: args.tenantId,
      subscriptionId: args.subscriptionId,
      number: await this.deps.invoiceRepository.nextNumber(args.tenantId),
      amount,
      currency: 'IDR',
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      dueDate: args.periodEnd,
      lineItems: [
        { description: `Perpanjangan ${args.days} hari`, amount, quantity: 1, total: amount },
      ],
      referenceType: args.referenceType,
      notes: args.notes ?? null,
    });
    return this.createWithRetry(invoice);
  }

  async listInvoices(tenantId: string, now: Date = new Date()): Promise<{
    items: ISubscriptionInvoice[];
    totals: { outstanding: number; paid: number };
  }> {
    const invoices = await this.deps.invoiceRepository.findByTenantId(tenantId);
    const items = invoices.map((inv) => {
      const s = inv.serialize();
      return { ...s, status: inv.effectiveStatus(now) };
    });
    const outstanding = items
      .filter((i) => i.status === 'pending' || i.status === 'overdue')
      .reduce((sum, i) => sum + i.amount, 0);
    const paid = items
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0);
    return { items, totals: { outstanding, paid } };
  }

  async listPaymentAttempts(tenantId: string, invoiceId?: string): Promise<{ items: IPaymentAttempt[] }> {
    const attempts = invoiceId
      ? await this.deps.paymentAttemptRepository.findByInvoiceId(tenantId, invoiceId)
      : await this.deps.paymentAttemptRepository.findByTenantId(tenantId);
    return { items: attempts.map((a) => a.serialize()) };
  }

  /**
   * The ONLY entry point that moves an invoice to `paid`. All settlement paths
   * (platform admin "Catat Pembayaran", future wallet debit / VA / gateway)
   * funnel through here so the rules live in exactly one place:
   *
   * - invoice must belong to the tenant, be unsettled, and match the amount;
   * - exactly one attempt may be `completed` per invoice — an attempt whose
   *   invoice was settled concurrently is persisted as `failed` for the trail;
   * - a `renewal` invoice (invoice-first renew) EXTENDS the subscription on
   *   settlement; assign/change/extended invoices never re-extend.
   */
  async recordPaymentAttempt(args: {
    tenantId: string;
    invoiceId: string;
    amount: number;
    method: string;
    referenceNumber?: string | null;
    notes?: string | null;
    actorEmail?: string | null;
  }): Promise<{ invoice: ISubscriptionInvoice; attempt: IPaymentAttempt }> {
    const invoice = await this.deps.invoiceRepository.findById(args.tenantId, args.invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice tidak ditemukan.');
    }
    const view = invoice.serialize();
    // Rejected attempts are recorded as `failed` for the payment trail — the
    // double-pay / mismatch / cancelled paths show up in the history too.
    const recordRejected = async (): Promise<void> => {
      const failed = PaymentAttempt.create({
        tenantId: args.tenantId,
        invoiceId: args.invoiceId,
        number: null,
        amount: args.amount,
        method: args.method,
        gateway: { provider: 'manual', txId: args.referenceNumber ?? null, vaNumber: null, qrUrl: null },
        actorEmail: args.actorEmail ?? null,
        notes: args.notes ?? null,
      });
      failed.fail();
      await this.deps.paymentAttemptRepository.save(failed);
    };
    if (view.status === 'cancelled') {
      await recordRejected();
      throw new ValidationError('Invoice sudah dibatalkan.');
    }
    if (view.status === 'paid') {
      await recordRejected();
      throw new ValidationError('Invoice sudah lunas.');
    }
    if (args.amount !== view.amount) {
      await recordRejected();
      throw new ValidationError('Nominal tidak sesuai dengan invoice.');
    }

    const attempt = PaymentAttempt.create({
      tenantId: args.tenantId,
      invoiceId: args.invoiceId,
      number: null,
      amount: args.amount,
      method: args.method,
      gateway: { provider: 'manual', txId: args.referenceNumber ?? null, vaNumber: null, qrUrl: null },
      actorEmail: args.actorEmail ?? null,
      notes: args.notes ?? null,
    });
    attempt.complete();

    // Atomic claim on the invoice; a concurrent settle loses here and its
    // attempt is persisted as failed (never completed) for the audit trail.
    const settled = await this.deps.invoiceRepository.markPaid(args.tenantId, args.invoiceId);
    if (!settled) {
      attempt.fail();
      await this.deps.paymentAttemptRepository.save(attempt);
      throw new ValidationError('Invoice sudah lunas.');
    }
    await this.deps.paymentAttemptRepository.save(attempt);

    const settledView = settled.serialize();
    if (settledView.referenceType === 'renewal') {
      const days = Math.max(
        1,
        Math.round((settledView.periodEnd.getTime() - settledView.periodStart.getTime()) / 86_400_000),
      );
      await this.deps.subscriptionService.extendSubscription(args.tenantId, days, {
        reason: 'Pembayaran diterima — perpanjangan (merchant)',
        actorEmail: args.actorEmail ?? null,
      });
    }

    return { invoice: settledView, attempt: attempt.serialize() };
  }

  async cancelInvoice(
    tenantId: string,
    invoiceId: string,
    reason?: string | null,
  ): Promise<{ invoice: ISubscriptionInvoice }> {
    const invoice = await this.deps.invoiceRepository.findById(tenantId, invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice tidak ditemukan.');
    }
    const view = invoice.serialize();
    if (view.status === 'paid') {
      throw new ValidationError('Invoice lunas tidak bisa dibatalkan.');
    }
    if (view.status === 'cancelled') {
      throw new ValidationError('Invoice sudah dibatalkan.');
    }
    invoice.cancel();
    await this.deps.invoiceRepository.save(invoice);
    return { invoice: invoice.serialize() };
  }

  /**
   * Persist an invoice, retrying on the unique `{tenantId, number}` collision
   * with a freshly allocated number (Batas #5: count+1, no atomic counter).
   */
  private async createWithRetry(invoice: SubscriptionInvoice): Promise<SubscriptionInvoice> {
    let current = invoice;
    for (let i = 0; i < 3; i++) {
      try {
        await this.deps.invoiceRepository.save(current);
        return current;
      } catch (err: unknown) {
        if ((err as { code?: number }).code !== 11000 || i >= 2) throw err;
        const { id, ...rest } = current.serialize();
        current = SubscriptionInvoice.create({
          ...rest,
          number: await this.deps.invoiceRepository.nextNumber(rest.tenantId),
        });
      }
    }
    return current;
  }
}