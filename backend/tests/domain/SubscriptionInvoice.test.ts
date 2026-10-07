import { describe, it, expect } from 'vitest';
import { SubscriptionInvoice } from '../../src/core/billing/domain/SubscriptionInvoice';

const NOW = new Date('2026-10-07T00:00:00.000Z');

function makeInvoice(partial: Record<string, unknown> = {}) {
  return SubscriptionInvoice.hydrate({
    id: 'inv-1',
    tenantId: 't1',
    subscriptionId: 'sub-1',
    number: 'SUB-2026-001',
    status: 'pending',
    amount: 500000,
    currency: 'IDR',
    periodStart: new Date('2026-10-01T00:00:00.000Z'),
    periodEnd: new Date('2026-11-30T00:00:00.000Z'),
    dueDate: new Date('2026-11-30T00:00:00.000Z'),
    paidAt: null,
    lineItems: [{ description: 'Perpanjangan 60 hari', amount: 500000, quantity: 1, total: 500000 }],
    referenceType: 'renewal',
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  });
}

describe('SubscriptionInvoice', () => {
  it('creates a pending invoice', () => {
    const invoice = SubscriptionInvoice.create({
      tenantId: 't1',
      subscriptionId: 'sub-1',
      number: 'SUB-2026-001',
      amount: 500000,
      currency: 'IDR',
      periodStart: NOW,
      periodEnd: new Date('2026-11-01T00:00:00.000Z'),
      dueDate: new Date('2026-11-01T00:00:00.000Z'),
      lineItems: [],
      referenceType: 'plan_assigned',
      notes: null,
    });
    expect(invoice.serialize().status).toBe('pending');
    expect(invoice.serialize().paidAt).toBeNull();
  });

  it('marks a pending invoice paid and stamps paidAt once', () => {
    const invoice = makeInvoice();
    invoice.markPaid();
    expect(invoice.serialize().status).toBe('paid');
    expect(invoice.serialize().paidAt).not.toBeNull();

    const paidAt = invoice.serialize().paidAt;
    invoice.markPaid();
    expect(invoice.serialize().paidAt).toBe(paidAt);
  });

  it('derives overdue at read time without storing it', () => {
    expect(makeInvoice().isOverdue(NOW)).toBe(false);

    const old = makeInvoice({ dueDate: new Date('2026-09-01T00:00:00.000Z') });
    expect(old.isOverdue(NOW)).toBe(true);
    expect(old.effectiveStatus(NOW)).toBe('overdue');
    expect(old.serialize().status).toBe('pending');
  });

  it('a paid invoice is never overdue', () => {
    const invoice = makeInvoice({ dueDate: new Date('2026-09-01T00:00:00.000Z') });
    invoice.markPaid();
    expect(invoice.isOverdue(NOW)).toBe(false);
    expect(invoice.effectiveStatus(NOW)).toBe('paid');
  });

  it('cancels only an unsettled invoice', () => {
    const invoice = makeInvoice();
    invoice.cancel();
    expect(invoice.serialize().status).toBe('cancelled');
    expect(invoice.isSettled()).toBe(true);
  });

  it('a paid invoice cannot be cancelled', () => {
    const invoice = makeInvoice();
    invoice.markPaid();
    invoice.cancel();
    expect(invoice.serialize().status).toBe('paid');
  });
});