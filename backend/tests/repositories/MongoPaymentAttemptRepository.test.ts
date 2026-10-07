import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoPaymentAttemptRepository } from '../../src/core/billing/infrastructure/persistence/MongoPaymentAttemptRepository';
import { PaymentAttemptSchema } from '../../src/core/billing/infrastructure/persistence/schemas/PaymentAttemptSchema';
import { PaymentAttempt } from '../../src/core/billing/domain/PaymentAttempt';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const T1 = 'tenant-a';
const T2 = 'tenant-b';

let model: Model<any>;
let repo: MongoPaymentAttemptRepository;

function makeAttempt(tenantId: string, invoiceId: string, partial: Record<string, unknown> = {}) {
  return PaymentAttempt.hydrate({
    id: '1',
    tenantId,
    invoiceId,
    number: null,
    amount: 500000,
    method: 'transfer',
    status: 'pending',
    gateway: { provider: 'manual', txId: 'TRX-001', vaNumber: null, qrUrl: null },
    actorEmail: 'admin@kuire.id',
    notes: null,
    startedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as any);
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('PaymentAttempt', PaymentAttemptSchema);
  repo = new MongoPaymentAttemptRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoPaymentAttemptRepository', () => {
  it('keeps one-to-many attempts per invoice (no unique invoiceId)', async () => {
    await repo.save(makeAttempt(T1, 'inv-1', { id: '1' }));
    await repo.save(makeAttempt(T1, 'inv-1', { id: '2' }));
    await repo.save(makeAttempt(T1, 'inv-2', { id: '3' }));

    expect(await repo.findByInvoiceId(T1, 'inv-1')).toHaveLength(2);
    expect(await repo.findByInvoiceId(T1, 'inv-2')).toHaveLength(1);
  });

  it('scopes attempts by tenant', async () => {
    await repo.save(makeAttempt(T1, 'inv-1', { id: '1' }));
    await repo.save(makeAttempt(T2, 'inv-1', { id: '2' }));

    expect(await repo.findById(T1, '1')).not.toBeNull();
    expect(await repo.findById(T1, '2')).toBeNull();
    expect(await repo.findById(T2, '2')).not.toBeNull();
    expect(await repo.findByTenantId(T1)).toHaveLength(1);
    expect(await repo.findByTenantId(T2)).toHaveLength(1);
  });

  it('persists terminal states', async () => {
    const ok = makeAttempt(T1, 'inv-1', { id: '1' });
    ok.complete();
    const fail = makeAttempt(T1, 'inv-2', { id: '2' });
    fail.fail();
    const expire = makeAttempt(T1, 'inv-3', { id: '3' });
    expire.expire();

    await repo.save(ok);
    await repo.save(fail);
    await repo.save(expire);

    expect((await repo.findById(T1, '1'))!.serialize().status).toBe('completed');
    expect((await repo.findById(T1, '2'))!.serialize().status).toBe('failed');
    expect((await repo.findById(T1, '3'))!.serialize().status).toBe('expired');
  });
});