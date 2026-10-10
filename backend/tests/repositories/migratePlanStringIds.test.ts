import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { PlanSchema } from '../../src/core/billing/infrastructure/persistence/schemas/PlanSchema';
import { SubscriptionSchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionSchema';
import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { SubscriptionHistorySchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionHistorySchema';
import { upsertDefaultPlans } from '../../src/core/billing/defaults/seedPlans';
import { DEFAULT_PLANS } from '../../src/core/billing/defaults/plans';
import { migratePlanStringIds } from '../../src/core/billing/infrastructure/persistence/migratePlanStringIds';
import { MongoPlanRepository } from '../../src/core/billing/infrastructure/persistence/MongoPlanRepository';

let planModel: Model<any>;
let subscriptionModel: Model<any>;
let tenantModel: Model<any>;
let historyModel: Model<any>;

beforeAll(async () => {
  await setupTestDb();
  planModel = mongoose.model('Plan', PlanSchema);
  subscriptionModel = mongoose.model('Subscription', SubscriptionSchema);
  tenantModel = mongoose.model('Tenant', TenantSchema);
  historyModel = mongoose.model('SubscriptionHistory', SubscriptionHistorySchema);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

const migrate = () =>
  migratePlanStringIds(planModel, {
    subscriptionModel,
    tenantModel,
    subscriptionHistoryModel: historyModel,
  });

/** Reproduces the old seeder state: DEFAULT_PLANS inserted WITHOUT `_id` → Mongo assigns ObjectId. */
async function seedLegacyPlans(): Promise<string[]> {
  const hexIds: string[] = [];
  for (const plan of DEFAULT_PLANS) {
    const { _id, ...rest } = plan;
    const res = await planModel.collection.insertOne(rest);
    hexIds.push(res.insertedId.toString());
  }
  return hexIds;
}

describe('DEFAULT_PLANS seeding — string `_id` contract', () => {
  it('upsertDefaultPlans stores stable string _ids and findById resolves', async () => {
    await upsertDefaultPlans(planModel);

    const repo = new MongoPlanRepository(planModel);
    for (const plan of DEFAULT_PLANS) {
      expect(typeof plan._id).toBe('string');
      expect(plan._id).toMatch(/^plan-/);
      const found = await repo.findById(plan._id as string);
      expect(found).not.toBeNull();
      expect(found!.serialize().name).toBe(plan.name);
    }

    const ids = (await planModel.collection.find().toArray()).map((d) => d._id);
    expect(ids.every((id) => typeof id === 'string')).toBe(true);
  });
});

describe('migratePlanStringIds', () => {
  it('rewrites legacy ObjectId _ids to stable strings and re-points references', async () => {
    const [trialHex, starterHex] = await seedLegacyPlans();
    await mongoose.connection.collection('subscriptions').insertOne({ planId: trialHex, tenantId: 't1' });
    await mongoose.connection.collection('tenants').insertOne({ planId: trialHex, name: 'T1' });
    await mongoose.connection.collection('subscription_history').insertOne({ planId: starterHex, tenantId: 't1' });

    const result = await migrate();
    expect(result.scanned).toBe(DEFAULT_PLANS.length);
    expect(result.migrated).toBe(DEFAULT_PLANS.length);
    expect(result.referencesUpdated).toBe(3);

    const docs = await planModel.collection.find().toArray();
    expect(docs.every((d) => typeof d._id === 'string')).toBe(true);

    const repo = new MongoPlanRepository(planModel);
    const trial = await repo.findById('plan-trial');
    expect(trial).not.toBeNull();
    expect(trial!.serialize().name).toBe('Trial');
    expect(await repo.findById('plan-pro')).not.toBeNull();

    expect((await mongoose.connection.collection('subscriptions').findOne({})).planId).toBe('plan-trial');
    expect((await mongoose.connection.collection('tenants').findOne({})).planId).toBe('plan-trial');
    expect((await mongoose.connection.collection('subscription_history').findOne({})).planId).toBe('plan-starter');

    // Second run is a no-op.
    const again = await migrate();
    expect(again.scanned).toBe(0);
    expect(again.migrated).toBe(0);
  });

  it('skips plans that already carry string ids (custom API-created plans)', async () => {
    await planModel.collection.insertOne({
      _id: 'plan-custom-abc',
      name: 'Custom',
      description: '',
      basePrice: 100000,
      billingCycle: 'monthly',
      isActive: true,
      isPublic: true,
      isDefault: false,
      sortOrder: 9,
      modules: [],
      limits: { maxUsers: 3, maxProducts: 10 },
      addOns: [],
    });

    const result = await migrate();
    expect(result.scanned).toBe(0);
    expect(result.migrated).toBe(0);

    const repo = new MongoPlanRepository(planModel);
    expect(await repo.findById('plan-custom-abc')).not.toBeNull();
  });

  it('suffixes a colliding derived id instead of overwriting the existing plan', async () => {
    // A custom plan already claims `plan-trial`.
    await planModel.collection.insertOne({
      _id: 'plan-trial',
      name: 'Trial Custom',
      description: '',
      basePrice: 100000,
      billingCycle: 'monthly',
      isActive: true,
      isPublic: true,
      isDefault: false,
      sortOrder: 9,
      modules: [],
      limits: { maxUsers: 3, maxProducts: 10 },
      addOns: [],
    });
    await seedLegacyPlans();

    const result = await migrate();
    expect(result.scanned).toBe(DEFAULT_PLANS.length);
    expect(result.migrated).toBe(DEFAULT_PLANS.length);

    const ids = (await planModel.collection.find().toArray()).map((d) => d._id);
    expect(ids).toContain('plan-trial'); // custom plan untouched
    expect(ids).toContain('plan-trial-2'); // legacy trial got the suffix
    expect(ids.every((id) => typeof id === 'string')).toBe(true);

    const repo = new MongoPlanRepository(planModel);
    await repo.findById('plan-trial-2');
    expect((await repo.findById('plan-trial-2'))!.serialize().name).toBe('Trial');
    expect((await repo.findById('plan-trial'))!.serialize().name).toBe('Trial Custom');
  });
});