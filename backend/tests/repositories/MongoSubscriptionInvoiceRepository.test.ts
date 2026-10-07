import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoSubscriptionInvoiceRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionInvoiceRepository';
import { SubscriptionInvoiceSchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionInvoiceSchema';
import { SubscriptionInvoice } from '../../src/core/billing/domain/SubscriptionInvoice';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const T1 = 'tenant-a';
const T2 = 'tenant-b';

let model: Model<any>;
let repo: MongoSubscriptionInvoiceRepository;

function makeInvoice(tenantId: string, partial: Record<string, unknown> = {}) {
  // hydrate (not create) so the id is deterministic for findById lookups.
  return SubscriptionInvoice.hydrate({
    id: '1',
    tenantId,
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as any);
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('SubscriptionInvoice', SubscriptionInvoiceSchema);
  repo = new MongoSubscriptionInvoiceRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoSubscriptionInvoiceRepository', () => {
  it('persists and finds an invoice scoped to its tenant', async () => {
    await repo.save(makeInvoice(T1));
    const found = await repo.findById(T1, '1');
    expect(found).not.toBeNull();
    expect(found!.serialize().number).toBe('SUB-2026-001');
    // tenant-scoped: same id on another tenant resolves to nothing
    expect(await repo.findById(T2, '1')).toBeNull();
  });

  it('lists invoices per tenant only', async () => {
    await repo.save(makeInvoice(T1, { id: '1' }));
    await repo.save(makeInvoice(T1, { id: '2', number: 'SUB-2026-002' }));
    await repo.save(makeInvoice(T2, { id: '3' }));

    expect(await repo.findByTenantId(T1)).toHaveLength(2);
    expect(await repo.findByTenantId(T2)).toHaveLength(1);
  });

  it('nextNumber allocates per-tenant sequence', async () => {
    expect(await repo.nextNumber(T1)).toBe('SUB-2026-001');
    await repo.save(makeInvoice(T1, { id: '1', number: 'SUB-2026-001' }));
    await repo.save(makeInvoice(T1, { id: '2', number: 'SUB-2026-002' }));
    expect(await repo.nextNumber(T1)).toBe('SUB-2026-003');
    // another tenant does not share the sequence
    expect(await repo.nextNumber(T2)).toBe('SUB-2026-001');
  });

  it('markPaid is atomic: a concurrent claim on the same invoice loses', async () => {
    await repo.save(makeInvoice(T1, { id: '1' }));
    const [winner, loser] = await Promise.all([
      repo.markPaid(T1, '1'),
      repo.markPaid(T1, '1'),
    ]);
    const paid = [winner, loser].filter((i) => i !== null);
    expect(paid).toHaveLength(1);
    expect(paid[0]!.serialize().status).toBe('paid');
    // losing claim did not mutate the document
    const stored = await repo.findById(T1, '1');
    expect(stored!.serialize().status).toBe('paid');
  });

  it('markPaid refuses a cancelled invoice', async () => {
    const inv = makeInvoice(T1, { id: '1' });
    inv.cancel();
    await repo.save(inv);
    expect(await repo.markPaid(T1, '1')).toBeNull();
  });

  it('number uniqueness is per tenant, not global', async () => {
    await repo.save(makeInvoice(T1, { id: '1', number: 'SUB-2026-001' }));
    // same number under another tenant is legal
    await expect(repo.save(makeInvoice(T2, { id: '2', number: 'SUB-2026-001' }))).resolves.not.toThrow();
    // duplicate under the same tenant collides
    await expect(repo.save(makeInvoice(T1, { id: '3', number: 'SUB-2026-001' }))).rejects.toMatchObject({
      code: 11000,
    });
  });
});