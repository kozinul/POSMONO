import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { TenantController } from '../../src/core/tenant/interfaces/http/controllers/TenantController';
import { createTenantRoutes } from '../../src/core/tenant/interfaces/http/routes/tenant.routes';
import { MongoSubscriptionRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionRepository';
import { MongoPlanRepository } from '../../src/core/billing/infrastructure/persistence/MongoPlanRepository';
import { MongoSubscriptionHistoryRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionHistoryRepository';
import { SubscriptionService } from '../../src/core/billing/application/services/SubscriptionService';
import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { Subscription } from '../../src/core/billing/domain/Subscription';
import { generateTestToken } from '../helpers/auth';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { SubscriptionSchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionSchema';
import { SubscriptionHistorySchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionHistorySchema';
import { PlanSchema } from '../../src/core/billing/infrastructure/persistence/schemas/PlanSchema';

let tenantModel: mongoose.Model<any>;
let subModel: mongoose.Model<any>;
let historyModel: mongoose.Model<any>;
let planModel: mongoose.Model<any>;
let tenantRepository: MongoTenantRepository;
let subscriptionRepository: MongoSubscriptionRepository;
let app: express.Express;

const TENANT_ID = 'tenant-masa-aktif-1';

function createTenantDoc(overrides: Record<string, unknown> = {}) {
  return new tenantModel({
    _id: TENANT_ID,
    id: TENANT_ID,
    name: 'Kopi Bali',
    slug: 'kopi-bali',
    domain: null,
    ownerId: 'owner-1',
    planId: 'trial',
    plan: 'trial',
    status: 'active',
    businessType: 'restaurant',
    businessCategory: '',
    address: '',
    phone: '',
    modules: ['pos'],
    databaseName: 'posmono_test',
    config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
    billingEmail: 'owner@kopibali.id',
    hubId: null,
    subscriptionExpiresAt: new Date('2026-10-01T00:00:00.000Z'),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  });
}

function createSubscriptionDoc(overrides: Record<string, unknown> = {}) {
  return new subModel({
    _id: `sub-${TENANT_ID}`,
    tenantId: TENANT_ID,
    planId: 'plan-trial',
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  });
}

beforeAll(async () => {
  await setupTestDb();
  tenantModel = mongoose.model('Tenant', TenantSchema);
  subModel = mongoose.model('Subscription', SubscriptionSchema);
  historyModel = mongoose.model('SubscriptionHistory', SubscriptionHistorySchema);
  planModel = mongoose.model('Plan', PlanSchema);

  tenantRepository = new MongoTenantRepository(tenantModel);
  subscriptionRepository = new MongoSubscriptionRepository(subModel);
  const planRepository = new MongoPlanRepository(planModel);
  const historyRepository = new MongoSubscriptionHistoryRepository(historyModel);
  const subscriptionService = new SubscriptionService(
    subscriptionRepository,
    planRepository,
    tenantRepository,
    historyRepository,
  );
  const tenantService = new TenantService(tenantRepository, { publish: vi.fn() } as any);

  app = express();
  app.use(express.json());
  app.use('/api/tenants', createTenantRoutes(new TenantController(tenantService, undefined, subscriptionService)));
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('masa aktif enforcement over HTTP', () => {
  it('DENY: getCurrent lazily suspends an expired tenant, with reason fields returned', async () => {
    await createTenantDoc().save();

    const res = await request(app)
      .get('/api/tenants/current')
      .set('Authorization', `Bearer ${generateTestToken({ tenant: TENANT_ID })}`)
      .expect(200);

    expect(res.body.data.status).toBe('suspended');
    expect(res.body.data.subscriptionExpiresAt).toBe('2026-10-01T00:00:00.000Z');
    expect(res.body.data.daysRemaining).toBe(0);

    const stored = await tenantModel.findById(TENANT_ID).lean();
    expect(stored.status).toBe('suspended');
  });

  it('ALLOW: getCurrent leaves a not-yet-expired tenant untouched and reports days left', async () => {
    await createTenantDoc({ subscriptionExpiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) }).save();

    const before = await tenantModel.findById(TENANT_ID).lean();
    const res = await request(app)
      .get('/api/tenants/current')
      .set('Authorization', `Bearer ${generateTestToken({ tenant: TENANT_ID })}`)
      .expect(200);

    expect(res.body.data.status).toBe('active');
    expect(res.body.data.daysRemaining).toBeGreaterThan(0);
    const after = await tenantModel.findById(TENANT_ID).lean();
    expect(after.status).toBe(before.status);
  });

  it('renew through the billing path syncs tenant and subscription clocks and reactivates', async () => {
    await createTenantDoc({ status: 'suspended', subscriptionExpiresAt: new Date('2026-10-01T00:00:00.000Z') }).save();
    await createSubscriptionDoc().save();

    const res = await request(app)
      .post('/api/tenants/current/subscription/renew')
      .set('Authorization', `Bearer ${generateTestToken({ tenant: TENANT_ID })}`)
      .send({ days: 30 })
      .expect(200);

    expect(res.body.data.message).toBe('Subscription successfully renewed');
    expect(res.body.data.subscription.status).toBe('active');

    const storedTenant = await tenantModel.findById(TENANT_ID).lean();
    const storedSub = await subModel.findOne({ tenantId: TENANT_ID }).lean();
    // Drift fix: both clocks move together (both fell back to "now" because
    // the stored end was already in the past, so allow sub-ms rounding).
    const tenantEnd = new Date(storedTenant.subscriptionExpiresAt).getTime();
    const subEnd = new Date(storedSub.currentPeriodEnd).getTime();
    expect(Math.abs(subEnd - tenantEnd)).toBeLessThan(1000);
    expect(tenantEnd).toBeGreaterThan(new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).getTime());

    const historyRows = await historyModel.find({ tenantId: TENANT_ID }).lean();
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].action).toBe('extended');
  });
});