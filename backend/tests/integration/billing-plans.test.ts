import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import request from 'supertest';
import express, { Express } from 'express';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { generateTestToken } from '../helpers/auth';
import { PLATFORM_ROLE_PERMS } from '../../src/core/platform/defaults/roles';

import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { MongoPlanRepository } from '../../src/core/billing/infrastructure/persistence/MongoPlanRepository';
import { MongoSubscriptionRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionRepository';

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { PlanSchema } from '../../src/core/billing/infrastructure/persistence/schemas/PlanSchema';
import { SubscriptionSchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionSchema';

import { Tenant } from '../../src/core/tenant/domain/Tenant';

import { PlanService } from '../../src/core/billing/application/services/PlanService';
import { SubscriptionService } from '../../src/core/billing/application/services/SubscriptionService';
import { EntitlementService } from '../../src/core/billing/application/services/EntitlementService';

import { PlanController } from '../../src/core/billing/interfaces/http/controllers/PlanController';
import { SubscriptionController } from '../../src/core/billing/interfaces/http/controllers/SubscriptionController';
import { createPlanRoutes } from '../../src/core/billing/interfaces/http/routes/plan.routes';
import { createPlatformSubscriptionRoutes } from '../../src/core/billing/interfaces/http/routes/subscription.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';

const TENANT_ID = 'tenant-plan-test';
const PLAN_TRIAL = 'plan-trial';
const PLAN_PRO = 'plan-pro';

let ctx: {
  app: Express;
  tenantRepo: MongoTenantRepository;
  planRepo: MongoPlanRepository;
  subRepo: MongoSubscriptionRepository;
  platformToken: string;
  readOnlyToken: string;
  tenantToken: string;
};

function seedTenant(repo: MongoTenantRepository, id: string = TENANT_ID) {
  const tenant = Tenant.hydrate({
    id,
    name: 'Tenant Plan Test',
    slug: 'plan-test',
    domain: null,
    ownerId: `owner-${id}`,
    plan: 'trial',
    planId: null,
    status: 'trial',
    businessType: 'restaurant',
    modules: [],
    databaseName: 'posmono_plan_test',
    config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
    billingEmail: 'plan-test@test.local',
    hubId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return repo.save(tenant);
}

const PRO_MODULES = ['products', 'orders', 'payments', 'shifts', 'customers', 'reports'];
const PRO_LIMITS = {
  maxUsers: 25,
  maxProducts: 2000,
  maxCategories: 100,
  maxOutlets: 3,
  maxOrdersPerMonth: 5000,
  maxInventoryItems: 10000,
  maxWarehouses: 3,
};

beforeAll(async () => {
  await setupTestDb();

  const tenantModel: Model<any> = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);
  const planModel: Model<any> = mongoose.models.Plan || mongoose.model('Plan', PlanSchema);
  const subModel: Model<any> = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);

  const tenantRepo = new MongoTenantRepository(tenantModel);
  const planRepo = new MongoPlanRepository(planModel);
  const subRepo = new MongoSubscriptionRepository(subModel);

  const planService = new PlanService(planRepo);
  const subscriptionService = new SubscriptionService(subRepo, planRepo, tenantRepo);
  const entitlementService = new EntitlementService(subRepo, planRepo, tenantRepo);

  const planController = new PlanController(planService);
  const subscriptionController = new SubscriptionController(subscriptionService, entitlementService);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/platform/plans', createPlanRoutes(planController));
  app.use('/api/platform', createPlatformSubscriptionRoutes(subscriptionController));
  app.use(errorHandler);

  ctx = {
    app,
    tenantRepo,
    planRepo,
    subRepo,
    platformToken: generateTestToken({
      sub: 'platform-admin',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: PLATFORM_ROLE_PERMS,
    }),
    readOnlyToken: generateTestToken({
      sub: 'platform-reader',
      tenant: 'platform',
      role: 'platform-admin',
      permissions: ['platform.plans.read', 'platform.tenants.read'],
    }),
    tenantToken: generateTestToken({
      sub: 'regular-user',
      tenant: TENANT_ID,
      role: 'owner',
      permissions: ['products:read'],
    }),
  };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
  await seedTenant(ctx.tenantRepo);
});

const platformAuth = () => `Bearer ${ctx.platformToken}`;
const readOnlyAuth = () => `Bearer ${ctx.readOnlyToken}`;
const tenantAuth = () => `Bearer ${ctx.tenantToken}`;

describe('Plan CRUD API (GET/POST/PUT/DELETE /api/platform/plans)', () => {
  const planPayload = {
    name: 'Pro',
    description: 'Plan untuk bisnis menengah',
    basePrice: 499000,
    billingCycle: 'monthly',
    isActive: true,
    isPublic: true,
    isDefault: true,
    sortOrder: 2,
    modules: PRO_MODULES,
    limits: PRO_LIMITS,
    addOns: [],
  };

  it('creates a plan and returns 201', async () => {
    const res = await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send(planPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Pro');
    expect(res.body.data.basePrice).toBe(499000);
    expect(res.body.data.isDefault).toBe(true);
    expect(res.body.data.modules).toEqual(PRO_MODULES);
    expect(res.body.data.limits.maxUsers).toBe(25);

    const inDb = await ctx.planRepo.findById(res.body.data.id);
    expect(inDb).not.toBeNull();
    expect(inDb!.serialize().name).toBe('Pro');
  });

  it('lists plans sorted by sortOrder then basePrice', async () => {
    await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send({ ...planPayload, name: 'Trial', basePrice: 0, sortOrder: 1, isDefault: false });
    await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send(planPayload);

    const res = await request(ctx.app).get('/api/platform/plans').set('Authorization', platformAuth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('Trial');
  });

  it('filters by ?active=true', async () => {
    await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send({ ...planPayload, name: 'Hidden', isActive: false });
    const res = await request(ctx.app).get('/api/platform/plans?active=true').set('Authorization', platformAuth());
    expect(res.body.data.length).toBe(0);
  });

  it('gets a plan by id', async () => {
    const created = await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send(planPayload);
    const res = await request(ctx.app).get(`/api/platform/plans/${created.body.data.id}`).set('Authorization', platformAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Pro');
  });

  it('updates a plan', async () => {
    const created = await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send(planPayload);
    const res = await request(ctx.app)
      .put(`/api/platform/plans/${created.body.data.id}`)
      .set('Authorization', platformAuth())
      .send({ basePrice: 499000, name: 'Pro Plus' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Pro Plus');
    expect(res.body.data.basePrice).toBe(499000);
  });

  it('returns 404 for unknown plan id', async () => {
    const res = await request(ctx.app).get('/api/platform/plans/does-not-exist').set('Authorization', platformAuth());
    expect(res.status).toBe(404);
  });

  it('rejects duplicate plan name', async () => {
    await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send(planPayload);
    const res = await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send({ ...planPayload, name: 'Pro' });
    expect(res.status).toBe(400);
  });

  it('rejects deletion of the default plan', async () => {
    const created = await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send(planPayload);
    const res = await request(ctx.app).delete(`/api/platform/plans/${created.body.data.id}`).set('Authorization', platformAuth());
    expect(res.status).toBe(400);
  });

  it('deletes a non-default plan', async () => {
    const created = await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send({ ...planPayload, name: 'Trial', isDefault: false });
    const res = await request(ctx.app).delete(`/api/platform/plans/${created.body.data.id}`).set('Authorization', platformAuth());
    expect(res.status).toBe(200);
    const inDb = await ctx.planRepo.findById(created.body.data.id);
    expect(inDb).toBeNull();
  });
});

describe('Plan API RBAC', () => {
  it('401 when session is not a platform session', async () => {
    const res = await request(ctx.app).get('/api/platform/plans').set('Authorization', tenantAuth());
    expect(res.status).toBe(401);
  });

  it('401 when unauthenticated', async () => {
    const res = await request(ctx.app).get('/api/platform/plans');
    expect(res.status).toBe(401);
  });

  it('403 for read-only platform token on POST (platform.plans.manage required)', async () => {
    const res = await request(ctx.app).post('/api/platform/plans').set('Authorization', readOnlyAuth()).send({ name: 'X', basePrice: 10000 });
    expect(res.status).toBe(403);
  });

  it('200 for read-only platform token on GET', async () => {
    const res = await request(ctx.app).get('/api/platform/plans').set('Authorization', readOnlyAuth());
    expect(res.status).toBe(200);
  });
});

describe('Subscription assignment API (POST/GET /api/platform/tenants/:id/subscription)', () => {
  beforeEach(async () => {
    await request(ctx.app)
      .post('/api/platform/plans')
      .set('Authorization', platformAuth())
      .send({ name: 'Pro', basePrice: 499000, billingCycle: 'monthly', isDefault: true, modules: PRO_MODULES, limits: PRO_LIMITS, addOns: [] });
  });

  it('assigns a plan to a tenant and updates the tenant entity', async () => {
    const plansRes = await request(ctx.app).get('/api/platform/plans').set('Authorization', platformAuth());
    const planId = plansRes.body.data[0].id;

    const sub = await request(ctx.app)
      .post(`/api/platform/tenants/${TENANT_ID}/subscription`)
      .set('Authorization', platformAuth())
      .send({ planId });
    expect(sub.status).toBe(200);
    expect(sub.body.data.planId).toBe(planId);

    const tenant = await ctx.tenantRepo.findById(TENANT_ID);
    expect(tenant).not.toBeNull();
    expect(tenant!.serialize().planId).toBe(planId);
    expect(tenant!.serialize().plan).toBe('Pro');
    expect(tenant!.serialize().modules).toEqual(PRO_MODULES);
    expect(tenant!.serialize().status).toBe('active');
    expect(tenant!.serialize().subscriptionExpiresAt).not.toBeNull();
  });

  it('assigns an explicit plan id', async () => {
    const created = await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send({ name: 'Starter', basePrice: 199000, billingCycle: 'annual', isDefault: false, modules: ['products', 'orders'], limits: PRO_LIMITS, addOns: [] });
    const planId = created.body.data.id;

    const sub = await request(ctx.app)
      .post(`/api/platform/tenants/${TENANT_ID}/subscription`)
      .set('Authorization', platformAuth())
      .send({ planId, billingCycle: 'annual' });
    expect(sub.status).toBe(200);
    expect(sub.body.data.planId).toBe(planId);
    expect(sub.body.data.billingCycle).toBe('annual');

    const tenant = await ctx.tenantRepo.findById(TENANT_ID);
    expect(tenant!.serialize().plan).toBe('Starter');
  });

  it('creates a subscription record in Mongo', async () => {
    const plansRes = await request(ctx.app).get('/api/platform/plans').set('Authorization', platformAuth());
    await request(ctx.app).post(`/api/platform/tenants/${TENANT_ID}/subscription`).set('Authorization', platformAuth()).send({ planId: plansRes.body.data[0].id });
    const subs = await mongoose.connection.collection('subscriptions').find().toArray();
    expect(subs).toHaveLength(1);
    expect(subs[0].tenantId).toBe(TENANT_ID);
    expect(subs[0].status).toBe('active');
  });

  it('returns the assigned subscription + plan', async () => {
    const plansRes = await request(ctx.app).get('/api/platform/plans').set('Authorization', platformAuth());
    await request(ctx.app).post(`/api/platform/tenants/${TENANT_ID}/subscription`).set('Authorization', platformAuth()).send({ planId: plansRes.body.data[0].id });
    const res = await request(ctx.app).get(`/api/platform/tenants/${TENANT_ID}/subscription`).set('Authorization', platformAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.subscription.status).toBe('active');
    expect(res.body.data.plan.name).toBe('Pro');
  });

  it('throws 404 when tenant does not exist', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/tenants/nope/subscription')
      .set('Authorization', platformAuth())
      .send({});
    expect(res.status).toBe(404);
  });

  it('throws 404 when plan does not exist', async () => {
    const res = await request(ctx.app)
      .post(`/api/platform/tenants/${TENANT_ID}/subscription`)
      .set('Authorization', platformAuth())
      .send({ planId: 'plan-ghost' });
    expect(res.status).toBe(404);
  });

  it('changes plan on existing subscription', async () => {
    const plansRes = await request(ctx.app).get('/api/platform/plans').set('Authorization', platformAuth());
    const a1 = await request(ctx.app)
      .post(`/api/platform/tenants/${TENANT_ID}/subscription`)
      .set('Authorization', platformAuth())
      .send({ planId: plansRes.body.data[0].id });
    const subId = a1.body.data.id;

    const created = await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send({ name: 'Enterprise', basePrice: 999000, billingCycle: 'annual', isDefault: false, modules: ['products'], limits: PRO_LIMITS, addOns: [] });
    const a2 = await request(ctx.app)
      .post(`/api/platform/tenants/${TENANT_ID}/subscription`)
      .set('Authorization', platformAuth())
      .send({ planId: created.body.data.id, billingCycle: 'annual' });

    expect(a2.status).toBe(200);
    expect(a2.body.data.id).toBe(subId);
    expect(a2.body.data.planId).toBe(created.body.data.id);
    expect(a2.body.data.billingCycle).toBe('annual');

    const tenant = await ctx.tenantRepo.findById(TENANT_ID);
    expect(tenant!.serialize().plan).toBe('Enterprise');
  });

  it('cancels a subscription and deactivates the tenant', async () => {
    const plansRes = await request(ctx.app).get('/api/platform/plans').set('Authorization', platformAuth());
    await request(ctx.app).post(`/api/platform/tenants/${TENANT_ID}/subscription`).set('Authorization', platformAuth()).send({ planId: plansRes.body.data[0].id });
    const res = await request(ctx.app).post(`/api/platform/tenants/${TENANT_ID}/subscription/cancel`).set('Authorization', platformAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');

    const tenant = await ctx.tenantRepo.findById(TENANT_ID);
    expect(tenant!.serialize().status).toBe('deactivated');
  });

  it('cancelling without a subscription returns 404', async () => {
    const res = await request(ctx.app).post(`/api/platform/tenants/${TENANT_ID}/subscription/cancel`).set('Authorization', platformAuth());
    expect(res.status).toBe(404);
  });
});

describe('Entitlement API (GET /api/platform/tenants/:id/entitlement)', () => {
  it('falls back to the default plan when no subscription exists', async () => {
    await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send({ name: 'Pro', basePrice: 499000, isDefault: true, modules: PRO_MODULES, limits: PRO_LIMITS, addOns: [] });
    const res = await request(ctx.app).get(`/api/platform/tenants/${TENANT_ID}/entitlement`).set('Authorization', platformAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.plan.name).toBe('Pro');
    expect(res.body.data.modules).toEqual(PRO_MODULES);
    expect(res.body.data.limits.maxUsers).toBe(25);
    expect(res.body.data.subscription).toBeNull();
  });

  it('reflects the assigned plan modules and limits', async () => {
    const created = await request(ctx.app).post('/api/platform/plans').set('Authorization', platformAuth()).send({ name: 'Starter', basePrice: 199000, isDefault: false, modules: ['products', 'orders'], limits: PRO_LIMITS, addOns: [] });
    await request(ctx.app).post(`/api/platform/tenants/${TENANT_ID}/subscription`).set('Authorization', platformAuth()).send({ planId: created.body.data.id });

    const res = await request(ctx.app).get(`/api/platform/tenants/${TENANT_ID}/entitlement`).set('Authorization', platformAuth());
    expect(res.body.data.plan.name).toBe('Starter');
    expect(res.body.data.modules).toEqual(['products', 'orders']);
    expect(res.body.data.subscription.status).toBe('active');
  });

  it('uses hardcoded trial defaults when no plan exists at all', async () => {
    const res = await request(ctx.app).get(`/api/platform/tenants/${TENANT_ID}/entitlement`).set('Authorization', platformAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.plan.name).toBe('Trial');
    expect(res.body.data.modules).toEqual(['products', 'orders', 'payments', 'shifts']);
  });
});