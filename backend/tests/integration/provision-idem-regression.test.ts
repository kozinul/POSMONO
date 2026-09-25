import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose, { Schema } from 'mongoose';
import { setupTestDb, teardownTestDb } from '../helpers/db';
import { MongoProvisioningRunRepository } from '../../src/core/platform/provisioning/infrastructure/persistence/MongoProvisioningRunRepository';
import { ProvisioningRun } from '../../src/core/platform/provisioning/domain/ProvisioningRun';

const COLL = `prov_reg_${Date.now()}`;

const TestSchema = new Schema(
  {
    _id: { type: String },
    requestId: { type: String, required: true },
    idempotencyKey: { type: String, default: undefined },
    tenantName: { type: String, required: true },
    ownerEmail: { type: String, required: true },
    hubId: { type: String, default: null },
    mode: { type: String, enum: ['standalone', 'hub'], required: true, default: 'standalone' },
    steps: [{ step: String, status: String, detail: String, durationMs: Number }],
    overallStatus: { type: String, enum: ['success', 'failed'], required: true, default: 'success' },
    durationMs: { type: Number, default: 0 },
    rolledBack: { type: Boolean, default: false },
    tenantId: { type: String, default: null },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true, collection: COLL },
);
TestSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

let repo: MongoProvisioningRunRepository;
let Model: mongoose.Model<any>;

const makeRun = (over: Record<string, unknown> = {}) =>
  ProvisioningRun.create({
    requestId: 'req-r',
    idempotencyKey: null,
    tenantName: 'T',
    ownerEmail: 'o@o.com',
    hubId: null,
    mode: 'standalone' as const,
    steps: [],
    overallStatus: 'success' as const,
    durationMs: 1,
    rolledBack: false,
    tenantId: null,
    result: null,
    error: null,
    createdAt: new Date(),
    ...over,
  });

beforeAll(async () => {
  await setupTestDb();
  Model = mongoose.model(`ProvReg${Date.now()}`, TestSchema);
  await Model.init();
  repo = new MongoProvisioningRunRepository(Model);
}, 60000);

afterAll(async () => {
  await mongoose.connection.db?.dropCollection(COLL).catch(() => {});
  await teardownTestDb();
});

describe('E11000 regression — repeated null idempotencyKey', () => {
  it('saves two runs without idempotency key (no E11000)', async () => {
    await repo.save(makeRun({ id: 'r1' }));
    await repo.save(makeRun({ id: 'r2' }));

    const docs = await Model.find({}).lean();
    expect(docs).toHaveLength(2);
    const hasField = docs.map((d: any) =>
      Object.prototype.hasOwnProperty.call(d, 'idempotencyKey'),
    );
    expect(hasField).toEqual([false, false]);
  });

  it('findByIdempotencyKey still works for real keys', async () => {
    await repo.save(makeRun({ id: 'r3', idempotencyKey: 'key-abc' }));

    const hit = await repo.findByIdempotencyKey('key-abc');
    expect(hit).not.toBeNull();
    expect(hit!.idempotencyKey).toBe('key-abc');

    const miss = await repo.findByIdempotencyKey('nonexistent');
    expect(miss).toBeNull();

    const total = await Model.countDocuments({});
    expect(total).toBe(3);
  });
});
