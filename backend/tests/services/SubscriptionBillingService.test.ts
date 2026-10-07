import { describe, it, expect, vi } from 'vitest';
import { SubscriptionBillingService } from '../../src/core/billing/application/services/SubscriptionBillingService';
import { SubscriptionInvoice } from '../../src/core/billing/domain/SubscriptionInvoice';
import { PaymentAttempt } from '../../src/core/billing/domain/PaymentAttempt';
import { NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';

const NOW = new Date('2026-10-07T00:00:00.000Z');

function baseInvoice(partial: Record<string, unknown> = {}) {
  // hydrate (not create) so id/status overrides in tests are honored.
  return SubscriptionInvoice.hydrate({
    id: 'inv-1',
    tenantId: 't1',
    subscriptionId: 'sub-1',
    number: 'SUB-2026-001',
    status: 'pending',
    amount: 500000,
    currency: 'IDR',
    periodStart: new Date('2026-10-01T00:00:00.000Z'),
    periodEnd: new Date('2026-10-31T00:00:00.000Z'),
    dueDate: new Date('2026-10-31T00:00:00.000Z'),
    paidAt: null,
    lineItems: [],
    referenceType: 'renewal',
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  } as any);
}

function makeInvoiceRepo() {
  const store = new Map<string, SubscriptionInvoice>();
  return {
    store,
    findById: vi.fn(async (tenantId: string, id: string) => {
      const inv = store.get(id);
      return inv && inv.serialize().tenantId === tenantId ? inv : null;
    }),
    findByTenantId: vi.fn(async (tenantId: string) =>
      [...store.values()].filter((i) => i.serialize().tenantId === tenantId),
    ),
    countByTenantId: vi.fn(async (tenantId: string) =>
      [...store.values()].filter((i) => i.serialize().tenantId === tenantId).length,
    ),
    nextNumber: vi.fn(async (tenantId: string) => {
      const n = [...store.values()].filter((i) => i.serialize().tenantId === tenantId).length + 1;
      return `SUB-2026-${String(n).padStart(3, '0')}`;
    }),
    markPaid: vi.fn(async (tenantId: string, id: string) => {
      const inv = store.get(id);
      if (!inv || inv.serialize().tenantId !== tenantId) return null;
      const s = inv.serialize();
      if (s.status === 'paid' || s.status === 'cancelled') return null;
      inv.markPaid();
      return inv;
    }),
    save: vi.fn(async (inv: SubscriptionInvoice) => {
      store.set(inv.serialize().id, inv);
    }),
  };
}

function makeAttemptRepo() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    save: vi.fn(async (a: PaymentAttempt) => {
      rows.push(a.serialize() as unknown as Record<string, unknown>);
    }),
    findById: vi.fn(async (tenantId: string, id: string) => {
      const row = rows.find((r) => r.tenantId === tenantId && r.id === id);
      return row ? PaymentAttempt.hydrate(row as any) : null;
    }),
    findByInvoiceId: vi.fn(async (tenantId: string, invoiceId: string) =>
      rows
        .filter((r) => r.tenantId === tenantId && r.invoiceId === invoiceId)
        .map((r) => PaymentAttempt.hydrate(r as any)),
    ),
    findByTenantId: vi.fn(async (tenantId: string) =>
      rows.filter((r) => r.tenantId === tenantId).map((r) => PaymentAttempt.hydrate(r as any)),
    ),
  };
}

function makePlanRepo(plans: Record<string, { name: string; basePrice: number }>) {
  return {
    findById: vi.fn(async (id: string) =>
      plans[id]
        ? { serialize: () => ({ id, name: plans[id].name, basePrice: plans[id].basePrice }) }
        : null,
    ),
  };
}

function build(options: { plans?: Record<string, { name: string; basePrice: number }> } = {}) {
  const invoiceRepo = makeInvoiceRepo();
  const attemptRepo = makeAttemptRepo();
  const planRepo = makePlanRepo(
    options.plans ?? { 'plan-pro': { name: 'Pro', basePrice: 500000 } },
  );
  const extendSubscription = vi.fn(async () => null);
  const service = new SubscriptionBillingService({
    invoiceRepository: invoiceRepo as any,
    paymentAttemptRepository: attemptRepo as any,
    planRepository: planRepo as any,
    subscriptionService: { extendSubscription } as any,
  });
  return { service, invoiceRepo, attemptRepo, planRepo, extendSubscription };
}

describe('SubscriptionBillingService.createInvoiceForPlan', () => {
  it('issues an invoice after a plan assignment (amount = plan basePrice)', async () => {
    const { service } = build();
    const invoice = await service.createInvoiceForPlan({
      tenantId: 't1',
      subscriptionId: 'sub-1',
      planId: 'plan-pro',
      referenceType: 'plan_assigned',
      periodStart: NOW,
      periodEnd: new Date('2026-11-06T00:00:00.000Z'),
    });
    expect(invoice).not.toBeNull();
    const s = invoice!.serialize();
    expect(s.number).toBe('SUB-2026-001');
    expect(s.amount).toBe(500000);
    expect(s.referenceType).toBe('plan_assigned');
    expect(s.lineItems[0].description).toBe('Plan Pro');
    expect(s.status).toBe('pending');
  });

  it('skips a plan without a price (Trial) instead of issuing a Rp 0 invoice', async () => {
    const { service } = build({ plans: { 'plan-trial': { name: 'Trial', basePrice: 0 } } });
    const invoice = await service.createInvoiceForPlan({
      tenantId: 't1',
      subscriptionId: null,
      planId: 'plan-trial',
      referenceType: 'plan_assigned',
      periodStart: NOW,
      periodEnd: new Date('2026-11-06T00:00:00.000Z'),
    });
    expect(invoice).toBeNull();
  });

  it('skips a missing plan document', async () => {
    const { service } = build();
    expect(
      await service.createInvoiceForPlan({
        tenantId: 't1',
        subscriptionId: null,
        planId: 'plan-hilang',
        referenceType: 'plan_assigned',
        periodStart: NOW,
        periodEnd: new Date('2026-11-06T00:00:00.000Z'),
      }),
    ).toBeNull();
  });

  it('retries with a fresh number when the sequence collides (E11000)', async () => {
    const { service, invoiceRepo } = build();
    // Simulate a concurrent writer winning number 001: first save fails with
    // E11000 while inserting a "rival" doc that owns the same number, so the
    // retried nextNumber sees the winner and moves to 002.
    invoiceRepo.save
      .mockImplementationOnce(async (inv: SubscriptionInvoice) => {
        const s = inv.serialize();
        const rival = SubscriptionInvoice.hydrate({
          ...s,
          id: 'rival',
        } as any);
        invoiceRepo.store.set('rival', rival);
        throw Object.assign(new Error('dup'), { code: 11000 });
      })
      .mockImplementation(async (inv: SubscriptionInvoice) => {
        invoiceRepo.store.set(inv.serialize().id, inv);
      });

    const invoice = await service.createInvoiceForPlan({
      tenantId: 't1',
      subscriptionId: 'sub-1',
      planId: 'plan-pro',
      referenceType: 'plan_assigned',
      periodStart: NOW,
      periodEnd: new Date('2026-11-06T00:00:00.000Z'),
    });

    expect(invoice).not.toBeNull();
    expect(invoice!.serialize().number).toBe('SUB-2026-002');
  });
});

describe('SubscriptionBillingService.createInvoiceForExtend', () => {
  it('prorates partial days: round(basePrice × days / 30)', async () => {
    const { service } = build();
    const invoice = await service.createInvoiceForExtend({
      tenantId: 't1',
      subscriptionId: 'sub-1',
      planId: 'plan-pro',
      referenceType: 'renewal',
      periodStart: new Date('2026-10-31T00:00:00.000Z'),
      periodEnd: new Date('2026-11-30T00:00:00.000Z'),
      days: 30,
    });
    expect(invoice!.serialize().amount).toBe(500000);
    expect(invoice!.serialize().lineItems[0].description).toBe('Perpanjangan 30 hari');
  });

  it('marks the reference type so settle knows whether to extend', async () => {
    const { service } = build();
    const renewal = await service.createInvoiceForExtend({
      tenantId: 't1',
      subscriptionId: 'sub-1',
      planId: 'plan-pro',
      referenceType: 'renewal',
      periodStart: NOW,
      periodEnd: new Date('2026-11-06T00:00:00.000Z'),
      days: 30,
    });
    const admin = await service.createInvoiceForExtend({
      tenantId: 't1',
      subscriptionId: 'sub-1',
      planId: 'plan-pro',
      referenceType: 'extended',
      periodStart: NOW,
      periodEnd: new Date('2026-11-06T00:00:00.000Z'),
      days: 30,
    });
    expect(renewal!.serialize().referenceType).toBe('renewal');
    expect(admin!.serialize().referenceType).toBe('extended');
  });
});

describe('SubscriptionBillingService.listInvoices', () => {
  it('computes outstanding/paid totals and derives overdue at read', async () => {
    const { service, invoiceRepo } = build();
    invoiceRepo.store.set(
      'inv-paid',
      baseInvoice({ id: 'inv-paid', status: 'paid', amount: 250000 }),
    );
    invoiceRepo.store.set(
      'inv-owed',
      baseInvoice({ id: 'inv-owed', dueDate: new Date('2026-09-01T00:00:00.000Z') }),
    );
    invoiceRepo.store.set(
      'inv-future',
      baseInvoice({ id: 'inv-future', dueDate: new Date('2026-12-01T00:00:00.000Z') }),
    );

    const { items, totals } = await service.listInvoices('t1', NOW);

    expect(items).toHaveLength(3);
    expect(items.find((i) => i.id === 'inv-owed')!.status).toBe('overdue');
    expect(totals).toEqual({ outstanding: 1000000, paid: 250000 });
  });
});

describe('SubscriptionBillingService.recordPaymentAttempt (settlement)', () => {
  it('ALLOW: settles a renewal invoice and extends the subscription', async () => {
    const { service, invoiceRepo, attemptRepo, extendSubscription } = build();
    invoiceRepo.store.set('inv-1', baseInvoice({ id: 'inv-1' }));

    const { invoice, attempt } = await service.recordPaymentAttempt({
      tenantId: 't1',
      invoiceId: 'inv-1',
      amount: 500000,
      method: 'transfer',
      referenceNumber: 'TRX-001',
      actorEmail: 'admin@kuire.id',
    });

    expect(invoice.status).toBe('paid');
    expect(invoice.paidAt).not.toBeNull();
    expect(attempt.status).toBe('completed');
    expect(attemptRepo.rows).toHaveLength(1);
    // renewal invoice → 30 days (period 2026-10-01 → 2026-10-31)
    expect(extendSubscription).toHaveBeenCalledWith(
      't1',
      30,
      expect.objectContaining({ actorEmail: 'admin@kuire.id' }),
    );
  });

  it('ALLOW: settles an admin extended invoice without re-extending', async () => {
    const { service, invoiceRepo, extendSubscription } = build();
    invoiceRepo.store.set(
      'inv-1',
      baseInvoice({ id: 'inv-1', referenceType: 'extended' }),
    );

    await service.recordPaymentAttempt({
      tenantId: 't1',
      invoiceId: 'inv-1',
      amount: 500000,
      method: 'cash',
    });

    expect(extendSubscription).not.toHaveBeenCalled();
  });

  it('DENY: an invoice of another tenant is not found', async () => {
    const { service, invoiceRepo } = build();
    invoiceRepo.store.set('inv-1', baseInvoice({ id: 'inv-1', tenantId: 't-other' }));

    await expect(
      service.recordPaymentAttempt({ tenantId: 't1', invoiceId: 'inv-1', amount: 500000, method: 'transfer' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('DENY: amount mismatch', async () => {
    const { service, invoiceRepo } = build();
    invoiceRepo.store.set('inv-1', baseInvoice({ id: 'inv-1' }));

    await expect(
      service.recordPaymentAttempt({ tenantId: 't1', invoiceId: 'inv-1', amount: 499999, method: 'transfer' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('DENY: double pay — a second attempt on a paid invoice fails and is recorded failed', async () => {
    const { service, invoiceRepo, attemptRepo } = build();
    invoiceRepo.store.set('inv-1', baseInvoice({ id: 'inv-1' }));

    await service.recordPaymentAttempt({ tenantId: 't1', invoiceId: 'inv-1', amount: 500000, method: 'transfer' });

    await expect(
      service.recordPaymentAttempt({ tenantId: 't1', invoiceId: 'inv-1', amount: 500000, method: 'qris' }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Both attempts are in the trail; the losing one is never completed.
    expect(attemptRepo.rows).toHaveLength(2);
    expect(attemptRepo.rows[1].status).toBe('failed');
  });

  it('DENY: a cancelled invoice cannot be settled', async () => {
    const { service, invoiceRepo } = build();
    const inv = baseInvoice({ id: 'inv-1' });
    inv.cancel();
    invoiceRepo.store.set('inv-1', inv);

    await expect(
      service.recordPaymentAttempt({ tenantId: 't1', invoiceId: 'inv-1', amount: 500000, method: 'transfer' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('failed/expired attempts never settle an invoice', async () => {
    const { service, invoiceRepo, attemptRepo } = build();
    invoiceRepo.store.set('inv-1', baseInvoice({ id: 'inv-1' }));

    // Two failed attempts in the store, untouched by the service.
    const fail = PaymentAttempt.create({
      tenantId: 't1', invoiceId: 'inv-1', amount: 500000, method: 'qris',
      gateway: null, actorEmail: null, notes: null,
    });
    fail.fail();
    await attemptRepo.save(fail);
    const exp = PaymentAttempt.create({
      tenantId: 't1', invoiceId: 'inv-1', amount: 500000, method: 'qris',
      gateway: null, actorEmail: null, notes: null,
    });
    exp.expire();
    await attemptRepo.save(exp);

    expect(invoiceRepo.store.get('inv-1')!.serialize().status).toBe('pending');
  });
});

describe('SubscriptionBillingService.cancelInvoice', () => {
  it('cancels a pending invoice', async () => {
    const { service, invoiceRepo } = build();
    invoiceRepo.store.set('inv-1', baseInvoice({ id: 'inv-1' }));
    const { invoice } = await service.cancelInvoice('t1', 'inv-1', 'Berhenti berlangganan');
    expect(invoice.status).toBe('cancelled');
  });

  it('DENY: a paid invoice cannot be cancelled', async () => {
    const { service, invoiceRepo } = build();
    const inv = baseInvoice({ id: 'inv-1' });
    inv.markPaid();
    invoiceRepo.store.set('inv-1', inv);

    await expect(service.cancelInvoice('t1', 'inv-1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('DENY: invoice of another tenant is not found', async () => {
    const { service, invoiceRepo } = build();
    invoiceRepo.store.set('inv-1', baseInvoice({ id: 'inv-1', tenantId: 't-other' }));

    await expect(service.cancelInvoice('t1', 'inv-1')).rejects.toBeInstanceOf(NotFoundError);
  });
});