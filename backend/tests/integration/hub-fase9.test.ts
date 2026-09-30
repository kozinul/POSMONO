import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import request from 'supertest';
import express, { Express } from 'express';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { generateTestToken, TEST_SECRET } from '../helpers/auth';
import jwt from 'jsonwebtoken';

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { HubMembershipSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMembershipSchema';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { SessionSchema } from '../../src/core/identity/infrastructure/persistence/schemas/SessionSchema';
import { OutletSchema } from '../../src/core/outlet/infrastructure/persistence/schemas/OutletSchema';
import { WarehouseSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/WarehouseSchema';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';

import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { MongoHubRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubRepository';
import { MongoHubMembershipRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMembershipRepository';
import { MongoUserRepository } from '../../src/core/identity/infrastructure/persistence/MongoUserRepository';
import { MongoOutletRepository } from '../../src/core/outlet/infrastructure/persistence/MongoOutletRepository';
import { MongoWarehouseRepository } from '../../src/core/inventory/infrastructure/persistence/MongoWarehouseRepository';
import { MongoShiftRepository } from '../../src/core/pos/infrastructure/persistence/MongoShiftRepository';
import { MongoPaymentRepository } from '../../src/core/payment/infrastructure/persistence/MongoPaymentRepository';

import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { Hub } from '../../src/core/hub/domain/Hub';
import { User } from '../../src/core/identity/domain/User';
import { Outlet } from '../../src/core/outlet/domain/Outlet';
import { Shift } from '../../src/core/pos/domain/Shift';
import { Payment } from '../../src/core/payment/domain/Payment';

import { HubService } from '../../src/core/hub/application/services/HubService';
import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { OutletService } from '../../src/core/outlet/application/services/OutletService';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { AuthService } from '../../src/core/identity/application/services/AuthService';
import { TokenService } from '../../src/core/identity/application/services/TokenService';
import { PasswordService } from '../../src/core/identity/domain/services/PasswordService';
import { SessionService } from '../../src/core/identity/application/services/SessionService';

import { HubController } from '../../src/core/hub/interfaces/http/controllers/HubController';
import { HubMembershipController } from '../../src/core/hub/interfaces/http/controllers/HubMembershipController';
import { PlatformController } from '../../src/core/platform/interfaces/http/controllers/PlatformController';
import { AuthController } from '../../src/core/identity/interfaces/http/controllers/AuthController';
import { createHubRoutes } from '../../src/core/hub/interfaces/http/routes/hub.routes';
import { createHubMembershipRoutes } from '../../src/core/hub/interfaces/http/routes/hubmembership.routes';
import { createPlatformRoutes } from '../../src/core/platform/interfaces/http/routes/platform.routes';
import { createAuthRoutes } from '../../src/core/identity/interfaces/http/routes/auth.routes';
import { tenantContext } from '../../src/@shared/interfaces/middleware/tenantContext';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';

const HUB_1 = 'hub-1';
const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';
const OWNER_USER = 'owner-alpha';
const GROUP_ADMIN = 'group-admin';

let ctx: {
  app: Express;
  tenantRepo: InstanceType<typeof MongoTenantRepository>;
  hubRepo: InstanceType<typeof MongoHubRepository>;
  membershipRepo: InstanceType<typeof MongoHubMembershipRepository>;
  userRepo: InstanceType<typeof MongoUserRepository>;
  shiftRepo: InstanceType<typeof MongoShiftRepository>;
  paymentRepo: InstanceType<typeof MongoPaymentRepository>;
  hubMembershipService: HubMembershipService;
  platformToken: string;
};

function seedTenant(repo: MongoTenantRepository, id: string, name: string, slug: string, hubId?: string) {
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

function seedHub(repo: MongoHubRepository, id: string, name: string) {
  const hub = Hub.hydrate({
    id,
    name,
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return repo.save(hub);
}

function seedUser(repo: MongoUserRepository, id: string, tenantId: string, email: string, displayName: string) {
  const user = User.hydrate({
    id,
    tenantId,
    email,
    passwordHash: '',
    displayName,
    roleId: 'role-' + id,
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

beforeAll(async () => {
  await setupTestDb();

  const tenantModel = mongoose.model('Tenant', TenantSchema);
  const hubModel = mongoose.model('Hub', HubSchema);
  const membershipModel = mongoose.model('HubMembership', HubMembershipSchema);
  const userModel = mongoose.model('User', UserSchema);
  const sessionModel = mongoose.model('Session', SessionSchema);
  const outletModel = mongoose.model('Outlet', OutletSchema);
  const warehouseModel = mongoose.model('Warehouse', WarehouseSchema);
  const shiftModel = mongoose.model('Shift', ShiftSchema);
  const paymentModel = mongoose.model('Payment', PaymentSchema);

  const tenantRepo = new MongoTenantRepository(tenantModel);
  const hubRepo = new MongoHubRepository(hubModel);
  const membershipRepo = new MongoHubMembershipRepository(membershipModel);
  const userRepo = new MongoUserRepository(userModel);
  const outletRepo = new MongoOutletRepository(outletModel);
  const warehouseRepo = new MongoWarehouseRepository(warehouseModel);
  const shiftRepo = new MongoShiftRepository(shiftModel);
  const paymentRepo = new MongoPaymentRepository(paymentModel);

  const hubService = new HubService(hubRepo, tenantRepo);
  const hubMembershipService = new HubMembershipService({
    hubMembershipRepository: membershipRepo,
    hubRepository: hubRepo,
    tenantRepository: tenantRepo,
    userRepository: userRepo,
  });

  const authService = new AuthService(
    userRepo,
    new TokenService(),
    new PasswordService(),
    new SessionService(sessionModel),
    undefined,
    hubMembershipService,
  );

  const shiftService = new ShiftService(shiftRepo);
  const paymentService = new PaymentService({
    paymentRepository: paymentRepo,
  });
  const outletService = new OutletService(outletRepo, warehouseRepo);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(tenantContext);
  app.use('/api/auth', createAuthRoutes(new AuthController(authService)));
  app.use('/api/hubs', createHubRoutes(new HubController(hubService)));
  app.use('/api/hub-memberships', createHubMembershipRoutes(new HubMembershipController(hubMembershipService)));
  app.use(
    '/api/platform',
    createPlatformRoutes(
      new PlatformController({
        hubService,
        tenantService: new TenantService(tenantRepo),
        outletService,
        shiftService,
        paymentService,
        tenantRepository: tenantRepo,
        hubRepository: hubRepo,
      }),
    ),
  );
  app.use(errorHandler);

  ctx = {
    app,
    tenantRepo,
    hubRepo,
    membershipRepo,
    userRepo,
    shiftRepo,
    paymentRepo,
    hubMembershipService,
    platformToken: generateTestToken({
      sub: 'platform-admin',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: ['platform.hubs.manage', 'platform.tenants.read', 'platform.reports.read'],
    }),
  };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
  await seedHub(ctx.hubRepo, HUB_1, 'BCA Hospitality');
  await seedTenant(ctx.tenantRepo, TENANT_A, 'Alpha Kopi', 'alpha-kopi', HUB_1);
  await seedTenant(ctx.tenantRepo, TENANT_B, 'Beta Resto', 'beta-resto', HUB_1);
  await seedUser(ctx.userRepo, OWNER_USER, TENANT_A, 'owner@alpha.test', 'Owner Alpha');
  await seedUser(ctx.userRepo, GROUP_ADMIN, TENANT_A, 'group@alpha.test', 'Group Admin');
});

const platformAuth = () => `Bearer ${ctx.platformToken}`;

describe('Fase 9 — Hub membership & cross-tenant session', () => {
  it('rejects member CRUD without platform.hubs.manage', async () => {
    const cashierToken = generateTestToken({ sub: 'cashier-1', tenant: TENANT_A, role: 'cashier', permissions: [] });
    const res = await request(ctx.app)
      .post('/api/hub-memberships')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ hubId: HUB_1, userId: GROUP_ADMIN, role: 'admin' });
    expect(res.status).toBe(401);
  });

  it('adds, lists and removes members over HTTP', async () => {
    const added = await request(ctx.app)
      .post('/api/hub-memberships')
      .set('Authorization', platformAuth())
      .send({ hubId: HUB_1, userId: GROUP_ADMIN, role: 'admin' });
    expect(added.status).toBe(201);
    expect(added.body.data).toMatchObject({ hubId: HUB_1, userId: GROUP_ADMIN, role: 'admin' });

    const dup = await request(ctx.app)
      .post('/api/hub-memberships')
      .set('Authorization', platformAuth())
      .send({ hubId: HUB_1, userId: GROUP_ADMIN, role: 'owner' });
    expect(dup.status).toBe(409);

    const listed = await request(ctx.app)
      .get(`/api/hub-memberships/hub/${HUB_1}`)
      .set('Authorization', platformAuth());
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].displayName).toBe('Group Admin');
    expect(listed.body.data[0].email).toBe('group@alpha.test');

    const rm = await request(ctx.app)
      .delete(`/api/hub-memberships/${HUB_1}/${GROUP_ADMIN}`)
      .set('Authorization', platformAuth());
    expect(rm.status).toBe(204);

    const empty = await request(ctx.app)
      .get(`/api/hub-memberships/hub/${HUB_1}`)
      .set('Authorization', platformAuth());
    expect(empty.body.data).toHaveLength(0);
  });

  it('fails for unknown user or invalid role', async () => {
    const badUser = await request(ctx.app)
      .post('/api/hub-memberships')
      .set('Authorization', platformAuth())
      .send({ hubId: HUB_1, userId: 'ghost', role: 'admin' });
    expect(badUser.status).toBe(404);

    const badRole = await request(ctx.app)
      .post('/api/hub-memberships')
      .set('Authorization', platformAuth())
      .send({ hubId: HUB_1, userId: GROUP_ADMIN, role: 'superuser' });
    expect(badRole.status).toBe(400);
  });
});

describe('Fase 9 — auth switch-tenant session (lintas-tenant)', () => {
  async function grantMembership(userId: string, role = 'owner') {
    const res = await request(ctx.app)
      .post('/api/hub-memberships')
      .set('Authorization', platformAuth())
      .send({ hubId: HUB_1, userId, role });
    expect(res.status).toBe(201);
  }

  it('returns accessible tenants for a hub member', async () => {
    await grantMembership(GROUP_ADMIN, 'admin');
    const token = generateTestToken({ sub: GROUP_ADMIN, tenant: TENANT_A, role: 'role-x', permissions: [] });

    const res = await request(ctx.app)
      .get('/api/auth/accessible-tenants')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((t: any) => t.tenantId).sort()).toEqual([TENANT_A, TENANT_B]);
    expect(res.body.data[0].hubName).toBe('BCA Hospitality');
    expect(res.body.data[0].role).toBe('admin');
  });

  it('returns empty accessible tenants when the user has no membership', async () => {
    const token = generateTestToken({ sub: OWNER_USER, tenant: TENANT_A, role: 'role-x', permissions: [] });
    const res = await request(ctx.app)
      .get('/api/auth/accessible-tenants')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('switch-tenant issues a token scoped to the target tenant', async () => {
    await grantMembership(GROUP_ADMIN, 'owner');
    const token = generateTestToken({ sub: GROUP_ADMIN, tenant: TENANT_A, role: 'role-x', permissions: [] });

    const res = await request(ctx.app)
      .post('/api/auth/switch-tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: TENANT_B });
    expect(res.status).toBe(200);

    const payload = jwt.verify(res.body.data.accessToken, TEST_SECRET) as any;
    expect(payload.tenant).toBe(TENANT_B);
    expect(payload.role).toBe('hub-owner');
    expect(payload.roleName).toBe('Hub Owner');
    expect(payload.permissions).toContain('reports:read');
    expect(payload.outletIds).toEqual([]);
    expect(res.body.data.user.roleName).toBe('Hub Owner');
  });

  it('switch-tenant rejects tenants not covered by membership', async () => {
    await grantMembership(GROUP_ADMIN, 'viewer');
    const token = generateTestToken({ sub: GROUP_ADMIN, tenant: TENANT_A, role: 'role-x', permissions: [] });

    const res = await request(ctx.app)
      .post('/api/auth/switch-tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: 'tenant-not-member' });
    expect(res.status).toBe(403);
  });

  it('GET /auth/me works with a switched cross-tenant token', async () => {
    await grantMembership(GROUP_ADMIN, 'admin');
    const token = generateTestToken({ sub: GROUP_ADMIN, tenant: TENANT_A, role: 'role-x', permissions: [] });

    const switched = await request(ctx.app)
      .post('/api/auth/switch-tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: TENANT_B });
    expect(switched.status).toBe(200);

    const me = await request(ctx.app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${switched.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(GROUP_ADMIN);
    expect(me.body.data.roleName).toBe('Hub Admin');
    expect(me.body.data.permissions).toContain('reports:read');
  });
});

describe('Fase 9 — Hub consolidated report', () => {
  it('returns tenant→outlet breakdown of shifts and payments', async () => {
    await ctx.shiftRepo.save(
      Shift.hydrate({
        id: 'shift-a1',
        tenantId: TENANT_A,
        outletId: 'outlet-a-1',
        registerId: 'r1',
        cashierId: 'cashier-1',
        cashierName: 'Kasir',
        openingBalance: 0,
        expectedCash: 0,
        cashSales: 80000,
        nonCashSales: 20000,
        totalSales: 100000,
        totalTransactions: 3,
        status: 'open',
        openedAt: new Date(),
        closedAt: null,
        voidedCount: 0,
        paymentBreakdown: [],
        cashPickups: [],
        expectedTotal: 0,
        carriedOverBills: [],
      } as any),
    );
    await ctx.shiftRepo.save(
      Shift.hydrate({
        id: 'shift-b1',
        tenantId: TENANT_B,
        outletId: 'outlet-b-1',
        registerId: 'r2',
        cashierId: 'cashier-2',
        cashierName: 'Kasir',
        openingBalance: 0,
        expectedCash: 0,
        cashSales: 0,
        nonCashSales: 50000,
        totalSales: 50000,
        totalTransactions: 1,
        status: 'closed',
        openedAt: new Date(),
        closedAt: new Date(),
        voidedCount: 0,
        paymentBreakdown: [],
        cashPickups: [],
        expectedTotal: 0,
        carriedOverBills: [],
      } as any),
    );

    const payA = Payment.create({ tenantId: TENANT_A, orderId: 'o1', amount: 80000, status: 'pending', method: 'cash', referenceNumber: 'C-1', metadata: {}, paidAt: null, outletId: 'outlet-a-1' });
    payA.complete();
    const payB = Payment.create({ tenantId: TENANT_B, orderId: 'o2', amount: 50000, status: 'pending', method: 'qris', referenceNumber: 'Q-1', metadata: {}, paidAt: null, outletId: 'outlet-b-1' });
    payB.complete();

    await ctx.paymentRepo.save(payA);
    await ctx.paymentRepo.save(payB);

    // outlets for name mapping
    const outletModel = mongoose.model('Outlet', OutletSchema);
    const outletRepo = new MongoOutletRepository(outletModel);
    await outletRepo.save(Outlet.hydrate({
      id: 'outlet-a-1',
      tenantId: TENANT_A,
      name: 'Outlet Alpha 1',
      address: '',
      phone: '',
      warehouseId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any));
    await outletRepo.save(Outlet.hydrate({
      id: 'outlet-b-1',
      tenantId: TENANT_B,
      name: 'Outlet Beta 1',
      address: '',
      phone: '',
      warehouseId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any));

    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/consolidated`)
      .set('Authorization', platformAuth());
    expect(res.status).toBe(200);

    const data = res.body.data;
    expect(data.hub.id).toBe(HUB_1);
    expect(data.tenantCount).toBe(2);
    expect(data.totals.openShifts).toBe(1);
    expect(data.totals.closedShifts).toBe(1);
    expect(data.totals.shiftSales).toBe(150000);
    expect(data.totals.paymentAmount).toBe(130000);
    expect(data.totals.paymentTransactions).toBe(2);

    const alpha = data.tenants.find((t: any) => t.tenantId === TENANT_A);
    expect(alpha.tenantName).toBe('Alpha Kopi');
    expect(alpha.outlets.find((o: any) => o.outletId === 'outlet-a-1').outletName).toBe('Outlet Alpha 1');
    expect(alpha.outlets.find((o: any) => o.outletId === 'outlet-a-1').shifts.openShifts).toBe(1);
    expect(alpha.outlets.find((o: any) => o.outletId === 'outlet-a-1').payments.totalAmount).toBe(80000);
  });

  it('requires platform.reports.read', async () => {
    const restricted = generateTestToken({
      sub: 'platform-admin-2',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: ['platform.hubs.manage'],
    });
    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/consolidated`)
      .set('Authorization', `Bearer ${restricted}`);
    expect(res.status).toBe(403);
  });

  it('rejects non-platform sessions', async () => {
    const tenantToken = generateTestToken({ sub: 'owner-a', tenant: TENANT_A, permissions: ['platform.hubs.manage'] });
    const res = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB_1}/consolidated`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(401);
  });
});

describe('Hub V2 Fase 16 — permission namespace over HTTP', () => {
  it('rejects a platform session that still carries the legacy hub:manage permission', async () => {
    const legacyToken = generateTestToken({
      sub: 'platform-admin-legacy',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: ['hub:manage'],
    });

    const hubs = await request(ctx.app).get('/api/hubs').set('Authorization', `Bearer ${legacyToken}`);
    expect(hubs.status).toBe(403);

    const members = await request(ctx.app)
      .post('/api/hub-memberships')
      .set('Authorization', `Bearer ${legacyToken}`)
      .send({ hubId: HUB_1, userId: GROUP_ADMIN, role: 'admin' });
    expect(members.status).toBe(403);
  });

  it('accepts the renamed platform.hubs.manage permission', async () => {
    const hubs = await request(ctx.app).get('/api/hubs').set('Authorization', platformAuth());
    expect(hubs.status).toBe(200);
    expect(hubs.body.data.map((h: any) => h.id)).toContain(HUB_1);
  });

  it('accepts the manager hub role', async () => {
    const added = await request(ctx.app)
      .post('/api/hub-memberships')
      .set('Authorization', platformAuth())
      .send({ hubId: HUB_1, userId: GROUP_ADMIN, role: 'manager' });
    expect(added.status).toBe(201);
    expect(added.body.data.role).toBe('manager');

    const list = await request(ctx.app)
      .get(`/api/hub-memberships/hub/${HUB_1}`)
      .set('Authorization', platformAuth());
    expect(list.body.data.some((m: any) => m.role === 'manager')).toBe(true);
  });

  it('still rejects an unknown hub role', async () => {
    const res = await request(ctx.app)
      .post('/api/hub-memberships')
      .set('Authorization', platformAuth())
      .send({ hubId: HUB_1, userId: GROUP_ADMIN, role: 'superadmin' });
    expect(res.status).toBe(400);
  });
});
