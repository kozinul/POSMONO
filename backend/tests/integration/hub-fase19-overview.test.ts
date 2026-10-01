import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose, { Model } from 'mongoose';
import request from 'supertest';
import express, { Express } from 'express';
import { makeHub } from '../fixtures/hub.fixtures';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { generateTestToken } from '../helpers/auth';
import { PLATFORM_ROLE_PERMS } from '../../src/core/platform/defaults/roles';

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { HubMembershipSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMembershipSchema';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { OutletSchema } from '../../src/core/outlet/infrastructure/persistence/schemas/OutletSchema';
import { WarehouseSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/WarehouseSchema';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { OrderSchema } from '../../src/core/ordering/infrastructure/persistence/schemas/OrderSchema';
import { SubscriptionSchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionSchema';
import { PlanSchema } from '../../src/core/billing/infrastructure/persistence/schemas/PlanSchema';

import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { MongoHubRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubRepository';
import { MongoHubMembershipRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMembershipRepository';
import { MongoUserRepository } from '../../src/core/identity/infrastructure/persistence/MongoUserRepository';
import { MongoOutletRepository } from '../../src/core/outlet/infrastructure/persistence/MongoOutletRepository';
import { MongoWarehouseRepository } from '../../src/core/inventory/infrastructure/persistence/MongoWarehouseRepository';
import { MongoShiftRepository } from '../../src/core/pos/infrastructure/persistence/MongoShiftRepository';
import { MongoPaymentRepository } from '../../src/core/payment/infrastructure/persistence/MongoPaymentRepository';
import { MongoSubscriptionRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionRepository';
import { MongoPlanRepository } from '../../src/core/billing/infrastructure/persistence/MongoPlanRepository';

import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { User } from '../../src/core/identity/domain/User';
import { Outlet } from '../../src/core/outlet/domain/Outlet';
import { Warehouse } from '../../src/core/inventory/domain/Warehouse';
import { Shift } from '../../src/core/pos/domain/Shift';
import { Payment } from '../../src/core/payment/domain/Payment';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { Subscription } from '../../src/core/billing/domain/Subscription';
import { Plan } from '../../src/core/billing/domain/Plan';

import { HubService } from '../../src/core/hub/application/services/HubService';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { OutletService } from '../../src/core/outlet/application/services/OutletService';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';
import { SubscriptionService } from '../../src/core/billing/application/services/SubscriptionService';
import { ReportAggregation } from '../../src/core/reporting/infrastructure/aggregation/ReportAggregation';
import { ReportService } from '../../src/core/reporting/application/services/ReportService';

import { PlatformController } from '../../src/core/platform/interfaces/http/controllers/PlatformController';
import { createPlatformRoutes } from '../../src/core/platform/interfaces/http/routes/platform.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';

const HUB_1 = 'hub-1';
const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';
const TENANT_OUTSIDE = 'tenant-luar-hub';

let ctx: {
  app: Express;
  tenantRepo: MongoTenantRepository;
  hubRepo: MongoHubRepository;
  outletRepo: MongoOutletRepository;
  warehouseRepo: MongoWarehouseRepository;
  membershipRepo: MongoHubMembershipRepository;
  userRepo: MongoUserRepository;
  shiftRepo: MongoShiftRepository;
  orderModel: Model<any>;
  planRepo: MongoPlanRepository;
  subRepo: MongoSubscriptionRepository;
  reportService: ReportService;
  platformToken: string;
  tenantToken: string;
};

function seedTenant(repo: MongoTenantRepository, id: string, name: string, slug: string, hubId?: string | null) {
  const tenant = Tenant.hydrate({
    id,
    name,
    slug,
    domain: null,
    ownerId: `owner-${id}`,
    plan: 'trial',
    status: 'trial',
    businessType: 'restaurant',
    modules: ['pos'],
    databaseName: `posmono_${slug}`,
    config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
    billingEmail: `${slug}@test.local`,
    hubId: hubId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return repo.save(tenant);
}

function seedOutlet(repo: MongoOutletRepository, warehouseRepo: MongoWarehouseRepository, opts: {
  id: string;
  tenantId: string;
  name: string;
  isActive?: boolean;
}) {
  const warehouse = Warehouse.hydrate({
    id: `wh-${opts.id}`,
    tenantId: opts.tenantId,
    outletId: opts.id,
    name: `Warehouse ${opts.name}`,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return warehouseRepo.save(warehouse).then(() => {
    const outlet = Outlet.hydrate({
      id: opts.id,
      tenantId: opts.tenantId,
      name: opts.name,
      address: '',
      phone: '',
      warehouseId: `wh-${opts.id}`,
      isActive: opts.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    return repo.save(outlet);
  });
}

function seedUser(repo: MongoUserRepository, opts: { id: string; tenantId: string; name: string; email: string }) {
  const user = User.hydrate({
    id: opts.id,
    tenantId: opts.tenantId,
    email: opts.email,
    passwordHash: 'hash',
    displayName: opts.name,
    roleId: `role-${opts.tenantId}`,
    outletIds: [],
    isActive: true,
    lastLoginAt: null,
    pin: null,
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return repo.save(user);
}

function seedMembership(repo: MongoHubMembershipRepository, hubId: string, userId: string, role = 'admin') {
  const membership = HubMembership.create({ hubId, userId, role: role as any });
  return repo.save(membership);
}

/** Raw order doc — the overview reads `orders` through one aggregation. */
async function seedOrder(model: Model<any>, opts: {
  id: string;
  tenantId: string;
  outletId?: string | null;
  total: number;
  roundingAdjustment?: number;
  tax?: number;
  discount?: number;
  status?: string;
  createdAt: Date;
}) {
  await model.create({
    _id: opts.id,
    tenantId: opts.tenantId,
    outletId: opts.outletId ?? null,
    orderNumber: opts.id,
    status: opts.status ?? 'paid',
    items: [],
    subtotal: opts.total,
    discount: opts.discount ?? 0,
    discountTotal: opts.discount ?? 0,
    tax: opts.tax ?? 0,
    total: opts.total,
    roundingAdjustment: opts.roundingAdjustment ?? 0,
    serviceCharge: 0,
    cashierId: 'cashier-1',
    createdAt: opts.createdAt,
    updatedAt: opts.createdAt,
  });
}

async function seedShift(repo: MongoShiftRepository, opts: {
  id: string;
  tenantId: string;
  outletId?: string | null;
  status: 'open' | 'closed';
  openedAt: Date;
}) {
  const shift = Shift.open({
    tenantId: opts.tenantId,
    outletId: opts.outletId ?? null,
    registerId: 'register-default',
    cashierId: `cashier-${opts.id}`,
    openingBalance: 0,
  } as any);
  if (opts.status === 'closed') {
    shift.close(0);
  }
  // Opened-at is what the aggregation reads, so it is written directly rather
  // than faked with timers.
  await repo.save(shift);
  await (repo as any).model.updateOne({ _id: shift.serialize().id }, { $set: { openedAt: opts.openedAt, closedAt: opts.status === 'closed' ? opts.openedAt : null } });
  return shift;
}

async function seedPlan(repo: MongoPlanRepository, id: string, name: string) {
  const plan = Plan.create({
    name,
    description: '',
    basePrice: 100_000,
    billingCycle: 'monthly',
    isActive: true,
    isPublic: true,
    isDefault: false,
    sortOrder: 1,
    modules: ['pos'],
    limits: { maxUsers: 5, maxProducts: 100, maxCategories: 20, maxOutlets: 1, maxOrdersPerMonth: 500, maxInventoryItems: 500, maxWarehouses: 1 },
    addOns: [],
  } as any);
  const hydrated = Plan.hydrate({ ...plan.serialize(), id } as any);
  await repo.save(hydrated);
}

async function seedSubscription(repo: MongoSubscriptionRepository, opts: {
  id: string;
  tenantId: string;
  planId: string;
  status: string;
  periodEnd: Date;
}) {
  const sub = Subscription.create({
    tenantId: opts.tenantId,
    planId: opts.planId,
    status: opts.status as any,
    billingCycle: 'monthly',
    currentPeriodStart: new Date(opts.periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: opts.periodEnd,
  } as any);
  await repo.save(Subscription.hydrate({ ...sub.serialize(), id: opts.id } as any));
}

const day = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  await setupTestDb();
  const c = mongoose.connection;

  const tenantRepo = new MongoTenantRepository(c.model('Tenant', TenantSchema));
  const hubRepo = new MongoHubRepository(c.model('Hub', HubSchema));
  const membershipRepo = new MongoHubMembershipRepository(c.model('HubMembership', HubMembershipSchema));
  const userRepo = new MongoUserRepository(c.model('User', UserSchema));
  const outletRepo = new MongoOutletRepository(c.model('Outlet', OutletSchema));
  const warehouseRepo = new MongoWarehouseRepository(c.model('Warehouse', WarehouseSchema));
  const shiftRepo = new MongoShiftRepository(c.model('Shift', ShiftSchema));
  const paymentRepo = new MongoPaymentRepository(c.model('Payment', PaymentSchema));
  const orderModel = c.model('Order', OrderSchema);
  const subscriptionRepo = new MongoSubscriptionRepository(c.model('Subscription', SubscriptionSchema));
  const planRepo = new MongoPlanRepository(c.model('Plan', PlanSchema));

  const shiftService = new ShiftService(shiftRepo);
  const reportService = new ReportService(
    {} as any,
    shiftRepo,
    {} as any,
    new ReportAggregation(orderModel, c.model('Shift', ShiftSchema), c.model('Product', new mongoose.Schema({ _id: String })) as any, paymentRepo as any),
  );

  const hubMembershipService = new HubMembershipService({
    hubMembershipRepository: membershipRepo,
    hubRepository: hubRepo,
    tenantRepository: tenantRepo,
    userRepository: userRepo,
  });

  const platformController = new PlatformController({
    hubService: new HubService(hubRepo, tenantRepo),
    tenantService: new TenantService(tenantRepo),
    outletService: new OutletService(outletRepo, warehouseRepo),
    shiftService,
    paymentService: new PaymentService({ paymentRepository: paymentRepo }),
    tenantRepository: tenantRepo,
    hubRepository: hubRepo,
    hubMembershipService,
    subscriptionService: new SubscriptionService(subscriptionRepo, planRepo, tenantRepo),
    reportService,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/platform', createPlatformRoutes(platformController));
  app.use(errorHandler);

  ctx = {
    app,
    tenantRepo,
    hubRepo,
    outletRepo,
    warehouseRepo,
    membershipRepo,
    userRepo,
    shiftRepo,
    orderModel,
    planRepo,
    subRepo: subscriptionRepo,
    reportService,
    platformToken: generateTestToken({
      sub: 'platform-admin',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: PLATFORM_ROLE_PERMS,
    }),
    tenantToken: generateTestToken({ sub: 'owner-a', tenant: TENANT_A, permissions: ['platform.reports.read'] }),
  };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
  await ctx.hubRepo.save(makeHub({ id: HUB_1, name: 'BCA Hospitality', code: 'BCA' }));
  await seedTenant(ctx.tenantRepo, TENANT_A, 'Alpha Kopi', 'alpha-kopi', HUB_1);
  await seedTenant(ctx.tenantRepo, TENANT_B, 'Beta Resto', 'beta-resto', HUB_1);
  await seedTenant(ctx.tenantRepo, TENANT_OUTSIDE, 'Gamma Cafe', 'gamma-cafe', null);
});

const platformAuth = () => `Bearer ${ctx.platformToken}`;

describe('Hub overview (GET /api/platform/hubs/:hubId/overview) — Fase 19', () => {
  it('summarises tenants, outlets and members for the hub', async () => {
    await seedOutlet(ctx.outletRepo, ctx.warehouseRepo, { id: 'outlet-a-1', tenantId: TENANT_A, name: 'Sanur' });

    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', platformAuth())
      .expect(200);

    const { data } = res.body;
    expect(data.hub.id).toBe(HUB_1);
    expect(data.hub.code).toBe('BCA');
    expect(data.counts.tenants).toBe(2);
    expect(data.counts.outlets).toBe(1);
    expect(data.counts.activeOutlets).toBe(1);
    expect(data.counts.members).toBe(0);
  });

  it('excludes tenants outside the hub from sales and counts', async () => {
    const today = new Date();
    await seedOrder(ctx.orderModel, { id: 'ord-in', tenantId: TENANT_A, total: 100_000, createdAt: today });
    await seedOrder(ctx.orderModel, { id: 'ord-out', tenantId: TENANT_OUTSIDE, total: 999_999_999, createdAt: today });

    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', platformAuth())
      .expect(200);

    expect(res.body.data.sales.total).toBe(100_000);
    expect(res.body.data.sales.byTenant.map((t: any) => t.tenantId).sort()).toEqual([TENANT_A, TENANT_B]);
    expect(res.body.data.counts.tenants).toBe(2);
  });

  it('reports every hub tenant in sales, with Rp 0 for the ones that did not sell', async () => {
    const today = new Date();
    await seedOrder(ctx.orderModel, { id: 'ord-1', tenantId: TENANT_A, total: 250_000, createdAt: today });

    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', platformAuth())
      .expect(200);

    const rows = res.body.data.sales.byTenant;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ tenantId: TENANT_A, tenantName: 'Alpha Kopi', total: 250_000, transactions: 1 });
    // Sorted by revenue descending, so the silent tenant lands last with zero —
    // not omitted, which would read as "no data" instead of "no sales".
    expect(rows[1]).toMatchObject({ tenantId: TENANT_B, total: 0, transactions: 0 });
  });

  it('includes roundingAdjustment in revenue and ignores non-paid orders', async () => {
    const today = new Date();
    await seedOrder(ctx.orderModel, { id: 'ord-paid', tenantId: TENANT_A, total: 100_000, roundingAdjustment: 500, createdAt: today });
    await seedOrder(ctx.orderModel, { id: 'ord-void', tenantId: TENANT_A, total: 500_000, status: 'voided', createdAt: today });
    await seedOrder(ctx.orderModel, { id: 'ord-held', tenantId: TENANT_A, total: 400_000, status: 'held', createdAt: today });

    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', platformAuth())
      .expect(200);

    expect(res.body.data.sales.total).toBe(100_500);
    expect(res.body.data.sales.transactions).toBe(1);
  });

  it('honours the date range', async () => {
    const now = Date.now();
    await seedOrder(ctx.orderModel, { id: 'ord-in', tenantId: TENANT_A, total: 100_000, createdAt: new Date(now - 2 * day) });
    await seedOrder(ctx.orderModel, { id: 'ord-out', tenantId: TENANT_A, total: 700_000, createdAt: new Date(now - 20 * day) });

    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .query({ dateFrom: new Date(now - 3 * day).toISOString().split('T')[0], dateTo: new Date(now).toISOString().split('T')[0] })
      .set('Authorization', platformAuth())
      .expect(200);

    expect(res.body.data.sales.total).toBe(100_000);
  });

  it('reports outlet operational status: open shift, stale and never-used', async () => {
    await seedOutlet(ctx.outletRepo, ctx.warehouseRepo, { id: 'outlet-a-1', tenantId: TENANT_A, name: 'Sanur' });
    await seedOutlet(ctx.outletRepo, ctx.warehouseRepo, { id: 'outlet-a-2', tenantId: TENANT_A, name: 'Ubud' });
    await seedOutlet(ctx.outletRepo, ctx.warehouseRepo, { id: 'outlet-b-1', tenantId: TENANT_B, name: 'Kemang' });

    await seedShift(ctx.shiftRepo, { id: 'sh-open', tenantId: TENANT_A, outletId: 'outlet-a-1', status: 'open', openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000) });
    await seedShift(ctx.shiftRepo, { id: 'sh-old', tenantId: TENANT_A, outletId: 'outlet-a-2', status: 'closed', openedAt: new Date(Date.now() - 6 * day) });
    // Kemang never opened a shift at all.

    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', platformAuth())
      .expect(200);

    const { operational } = res.body.data;
    expect(operational.outletsWithOpenShift).toBe(1);
    expect(operational.outletsStale).toBe(2); // Ubud idle 6 hari + Kemang belum pernah shift
    expect(operational.outletsWithoutShift).toBe(1); // Kemang
    expect(operational.staleHours).toBe(24);
    expect(operational.outlets).toHaveLength(3); // incl. Kemang, which never opened a shift

    const sanur = operational.outlets.find((o: any) => o.outletId === 'outlet-a-1');
    expect(sanur).toMatchObject({ outletName: 'Sanur', tenantId: TENANT_A, tenantName: 'Alpha Kopi', isActive: true, hasOpenShift: true, isStale: false });
    expect(sanur.openShifts).toBe(1);

    const ubud = operational.outlets.find((o: any) => o.outletId === 'outlet-a-2');
    expect(ubud).toMatchObject({ outletName: 'Ubud', hasOpenShift: false, isStale: true });
    expect(ubud.idleHours).toBeGreaterThanOrEqual(6 * 24);

    // Open-shift outlets sort first so the operator sees live registers on top.
    expect(operational.outlets[0].outletId).toBe('outlet-a-1');
  });

  it('rolls up subscriptions per tenant with plan name and days remaining', async () => {
    await seedPlan(ctx.planRepo, 'plan-pro', 'Pro');
    await seedPlan(ctx.planRepo, 'plan-starter', 'Starter');
    await seedSubscription(ctx.subRepo, {
      id: 'sub-a',
      tenantId: TENANT_A,
      planId: 'plan-pro',
      status: 'active',
      periodEnd: new Date(Date.now() + 12 * day),
    });
    await seedSubscription(ctx.subRepo, {
      id: 'sub-b',
      tenantId: TENANT_B,
      planId: 'plan-starter',
      status: 'active',
      periodEnd: new Date(Date.now() + 3 * day),
    });

    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', platformAuth())
      .expect(200);

    const subs = res.body.data.subscription;
    expect(subs).toHaveLength(2);
    expect(subs.find((s: any) => s.tenantId === TENANT_A)).toMatchObject({
      tenantName: 'Alpha Kopi',
      planName: 'Pro',
      status: 'active',
      daysRemaining: 12,
    });
    expect(subs.find((s: any) => s.tenantId === TENANT_B).daysRemaining).toBe(3);
  });

  it('omits tenants without a subscription instead of reporting a fake plan', async () => {
    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', platformAuth())
      .expect(200);

    expect(res.body.data.subscription).toEqual([]);
  });

  it('counts hub members', async () => {
await seedUser(ctx.userRepo, { id: 'u-1', tenantId: TENANT_A, name: 'Budi', email: 'budi@test.local' });
    await seedUser(ctx.userRepo, { id: 'u-2', tenantId: TENANT_B, name: 'Sari', email: 'sari@test.local' });
    await seedMembership(ctx.membershipRepo, HUB_1, 'u-1');
    await seedMembership(ctx.membershipRepo, HUB_1, 'u-2', 'viewer');

    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', platformAuth())
      .expect(200);

    expect(res.body.data.counts.members).toBe(2);
  });

  it('404s for an unknown hub', async () => {
    await request(ctx.app)
      .get('/api/platform/hubs/hub-tidak-ada/overview')
      .set('Authorization', platformAuth())
      .expect(404);
  });

  it('rejects a tenant token with 401', async () => {
    await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', `Bearer ${ctx.tenantToken}`)
      .expect(401);
  });

  it('rejects a platform token without platform.reports.read with 403', async () => {
    const token = generateTestToken({
      sub: 'platform-admin',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: ['platform.hubs.manage'],
    });

    await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns zeros for a hub with no tenants, outlets or orders', async () => {
    await ctx.hubRepo.save(makeHub({ id: 'hub-kosong', name: 'Hub Kosong', code: 'KOSONG' }));

    const res = await request(ctx.app)
      .get('/api/platform/hubs/hub-kosong/overview')
      .set('Authorization', platformAuth())
      .expect(200);

    expect(res.body.data.counts).toMatchObject({ tenants: 0, outlets: 0, activeOutlets: 0, members: 0 });
    expect(res.body.data.sales).toMatchObject({ total: 0, transactions: 0 });
    expect(res.body.data.sales.byTenant).toEqual([]);
    expect(res.body.data.operational.outlets).toEqual([]);
    expect(res.body.data.subscription).toEqual([]);
  });

  it('issues one grouped aggregation per sales read, not one per tenant', async () => {
    const spy = vi.spyOn(ctx.orderModel, 'aggregate');

    await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .set('Authorization', platformAuth())
      .expect(200);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0][0]).toMatchObject({
      $match: { tenantId: { $in: expect.arrayContaining([TENANT_A, TENANT_B]) } },
    });
    expect(spy.mock.calls[0][0][1]).toMatchObject({ $group: { _id: '$tenantId' } });

    spy.mockRestore();
  });

  it('rejects a malformed date range with 400', async () => {
    await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/overview`)
      .query({ dateFrom: 'bukan-tanggal' })
      .set('Authorization', platformAuth())
      .expect(400);
  });
});