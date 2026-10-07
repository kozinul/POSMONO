import { describe, it, expect } from 'vitest';
import { PaymentAttempt } from '../../src/core/billing/domain/PaymentAttempt';

const NOW = new Date('2026-10-07T00:00:00.000Z');

function makeAttempt(partial: Record<string, unknown> = {}) {
  return PaymentAttempt.create({
    tenantId: 't1',
    invoiceId: 'inv-1',
    number: null,
    amount: 500000,
    method: 'transfer',
    gateway: { provider: 'manual', txId: 'TRX-001', vaNumber: null, qrUrl: null },
    actorEmail: 'admin@kuire.id',
    notes: null,
    ...partial,
  });
}

describe('PaymentAttempt', () => {
  it('creates a pending attempt', () => {
    const attempt = makeAttempt();
    expect(attempt.serialize().status).toBe('pending');
    expect(attempt.serialize().completedAt).toBeNull();
    expect(attempt.serialize().startedAt).toBeInstanceOf(Date);
  });

  it('completes a pending attempt the first time only', () => {
    const attempt = makeAttempt();
    expect(attempt.complete()).toBe(true);
    expect(attempt.serialize().status).toBe('completed');
    expect(attempt.serialize().completedAt).not.toBeNull();

    // Second completion is refused — the domain half of "one attempt per
    // invoice may succeed" (the service + atomic settle claim hold the other).
    expect(attempt.complete()).toBe(false);
    expect(attempt.serialize().status).toBe('completed');
  });

  it('fails and expires a pending attempt', () => {
    const failed = makeAttempt();
    expect(failed.fail()).toBe(true);
    expect(failed.serialize().status).toBe('failed');

    const expired = makeAttempt();
    expect(expired.expire()).toBe(true);
    expect(expired.serialize().status).toBe('expired');
  });

  it('a terminal attempt cannot move anywhere', () => {
    const attempt = makeAttempt();
    attempt.complete();
    expect(attempt.fail()).toBe(false);
    expect(attempt.expire()).toBe(false);
    expect(attempt.isTerminal()).toBe(true);
  });
});