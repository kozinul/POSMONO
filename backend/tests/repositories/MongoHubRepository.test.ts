import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { MongoHubRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubRepository';
import { migrateHubIdentity } from '../../src/core/hub/infrastructure/persistence/migrateHubIdentity';
import { makeHub } from '../fixtures/hub.fixtures';

let model: Model<any>;
let repo: MongoHubRepository;

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('Hub', HubSchema);
  repo = new MongoHubRepository(model);
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

async function insertRaw(doc: Record<string, unknown>) {
  await model.collection.insertOne(doc);
}

describe('MongoHubRepository', () => {
  it('persists code, status and the derived isActive mirror', async () => {
    await repo.save(makeHub({ id: 'h1', name: 'Kopi Nusantara' }));

    const doc = await model.collection.findOne({ _id: 'h1' });
    expect(doc).toMatchObject({ code: 'KOPI-NUSANTARA', status: 'active', isActive: true });
  });

  it('writes isActive=false for a suspended hub so old readers agree', async () => {
    await repo.save(makeHub({ id: 'h2', name: 'Kopi Nusantara', status: 'suspended' }));

    const doc = await model.collection.findOne({ _id: 'h2' });
    expect(doc).toMatchObject({ status: 'suspended', isActive: false });
  });

  it('finds a hub by its normalised code', async () => {
    await repo.save(makeHub({ id: 'h3', name: 'Kopi Nusantara', code: 'KOPI-NUSANTARA' }));

    expect((await repo.findByCode('kopi nusantara'))?.serialize().id).toBe('h3');
    expect((await repo.findByCode('KOPI-NUSANTARA'))?.serialize().id).toBe('h3');
    expect(await repo.findByCode('KOPI-LAIN')).toBeNull();
  });

  it('maps a legacy hub (no code, no status) to a derived code and active status', async () => {
    await insertRaw({ _id: 'legacy-1', name: 'Bali Group', description: null, isActive: true });

    const hub = await repo.findById('legacy-1');
    expect(hub?.serialize()).toMatchObject({ code: 'BALI-GROUP', status: 'active', isActive: true });
  });

  it('reads a legacy deactivated hub as suspended, not active', async () => {
    await insertRaw({ _id: 'legacy-2', name: 'Bali Group', description: null, isActive: false });

    const hub = await repo.findById('legacy-2');
    expect(hub?.serialize()).toMatchObject({ status: 'suspended', isActive: false });
    expect(hub?.isOperational()).toBe(false);
  });

  it('gives two hubs whose names normalise the same way distinct codes', async () => {
    await insertRaw({ _id: 'dup-1', name: 'Kopi Group', description: null });
    await insertRaw({ _id: 'dup-2', name: 'Kopi  Group', description: null });

    await migrateHubIdentity(model);

    const codes = (await model.collection.find({ _id: { $in: ['dup-1', 'dup-2'] } }).toArray()).map((d) => d.code);
    expect(new Set(codes).size).toBe(2);
  });

  it('falls back to an id-based code when the name normalises to nothing', async () => {
    await insertRaw({ _id: 'weird-1', name: '!!!', description: null });

    const hub = await repo.findById('weird-1');
    expect(hub?.serialize().code).toBe('HUB-WEIRD-1');
  });
});

describe('migrateHubIdentity', () => {
  it('backfills code and status on legacy hubs', async () => {
    await insertRaw({ _id: 'm1', name: 'Kopi Nusantara', description: null, isActive: true });
    await insertRaw({ _id: 'm2', name: 'Bali Group', description: null, isActive: false });

    const result = await migrateHubIdentity(model);

    // `m1` is active but has no stored `status` yet, so it still counts as a write.
    expect(result).toMatchObject({ scanned: 2, codeBackfilled: 2, statusBackfilled: 2 });
    expect(await model.collection.findOne({ _id: 'm1' })).toMatchObject({ code: 'KOPI-NUSANTARA', status: 'active' });
    expect(await model.collection.findOne({ _id: 'm2' })).toMatchObject({ code: 'BALI-GROUP', status: 'suspended' });
  });

  it('is idempotent — a second run changes nothing', async () => {
    await insertRaw({ _id: 'm1', name: 'Kopi Nusantara', description: null, isActive: true });
    await migrateHubIdentity(model);

    const second = await migrateHubIdentity(model);
    expect(second).toMatchObject({ codeBackfilled: 0, statusBackfilled: 0 });
  });

  it('keeps an existing code and a valid status untouched', async () => {
    await insertRaw({ _id: 'm3', name: 'Kopi Nusantara', code: 'KOPI-NUSANTARA', status: 'archived' });

    const result = await migrateHubIdentity(model);
    expect(result).toMatchObject({ codeBackfilled: 0, statusBackfilled: 0 });
    expect(await model.collection.findOne({ _id: 'm3' })).toMatchObject({ status: 'archived' });
  });

  it('suffixes colliding codes instead of failing the unique index', async () => {
    // `name` is unique, so the code collision has to come from three *different*
    // names that normalise to one code — which is exactly the real-world case.
    await insertRaw({ _id: 'c1', name: 'Kopi Group', description: null });
    await insertRaw({ _id: 'c2', name: 'Kopi  Group', description: null });
    await insertRaw({ _id: 'c3', name: 'Kopi-Group', description: null });

    await migrateHubIdentity(model);

    const codes = (await model.collection.find({ _id: { $in: ['c1', 'c2', 'c3'] } }).toArray()).map((d) => d.code);
    expect(new Set(codes).size).toBe(3);
    expect(codes).toContain('KOPI-GROUP');
  });

  it('produces codes that satisfy the unique index', async () => {
    await insertRaw({ _id: 'c1', name: 'Kopi Group', description: null });
    await insertRaw({ _id: 'c2', name: 'Kopi  Group', description: null });
    await migrateHubIdentity(model);

    await expect(model.syncIndexes()).resolves.toBeDefined();
  });
});