import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import request from 'supertest';
import express, { Express } from 'express';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { generateTestToken } from '../helpers/auth';
import { PLATFORM_ROLE_PERMS } from '../../src/core/platform/defaults/roles';

import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { MongoHubRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubRepository';
import { MongoOutletRepository } from '../../src/core/outlet/infrastructure/persistence/MongoOutletRepository';
import { MongoWarehouseRepository } from '../../src/core/inventory/infrastructure/persistence/MongoWarehouseRepository';
import { MongoShiftRepository } from '../../src/core/pos/infrastructure/persistence/MongoShiftRepository';
import { MongoPaymentRepository } from '../../src/core/payment/infrastructure/persistence/MongoPaymentRepository';
import { MongoUserRepository } from '../../src/core/identity/infrastructure/persistence/MongoUserRepository';
import { MongoRoleRepository } from '../../src/core/identity/infrastructure/persistence/MongoRoleRepository';
import { MongoHubMembershipRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMembershipRepository';

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { OutletSchema } from '../../src/core/outlet/infrastructure/persistence/schemas/OutletSchema';
import { WarehouseSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/WarehouseSchema';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { RoleSchema } from '../../src/core/identity/infrastructure/persistence/schemas/RoleSchema';
import { HubMembershipSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMembershipSchema';

import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { Hub } from '../../src/core/hub/domain/Hub';
import { Outlet } from '../../src/core/outlet/domain/Outlet';
import { Warehouse } from '../../src/core/inventory/domain/Warehouse';
import { Shift } from '../../src/core/pos/domain/Shift';
import { Payment } from '../../src/core/payment/domain/Payment';
import { User } from '../../src/core/identity/domain/User';
import { Role } from '../../src/core/identity/domain/Role';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';

import { HubService } from '../../src/core/hub/application/services/HubService';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { OutletService } from '../../src/core/outlet/application/services/OutletService';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';

import { HubController } from '../../src/core/hub/interfaces/http/controllers/HubController';
import { OutletController } from '../../src/core/outlet/interfaces/http/controllers/OutletController';
import { PlatformController } from '../../src/core/platform/interfaces/http/controllers/PlatformController';
import { createHubRoutes } from '../../src/core/hub/interfaces/http/routes/hub.routes';
import { createOutletRoutes } from '../../src/core/outlet/interfaces/http/routes/outlet.routes';
import { createPlatformRoutes } from '../../src/core/platform/interfaces/http/routes/platform.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';

const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';
const TENANT_C = 'tenant-gamma';
const HUB_1 = 'hub-1';

let ctx: {
  app: Express;
  tenantRepo: MongoTenantRepository;
  hubRepo: MongoHubRepository;
  outletRepo: MongoOutletRepository;
  shiftRepo: MongoShiftRepository;
  paymentRepo: MongoPaymentRepository;
  userRepo: MongoUserRepository;
  platformToken: string;
  tenantToken: string;
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

function seedUser(repo: MongoUserRepository, opts: {
  id: string;
  tenantId: string;
  displayName: string;
  email: string;
  roleId: string;
  isActive?: boolean;
}) {
  const user = User.hydrate({
    id: opts.id,
    tenantId: opts.tenantId,
    email: opts.email,
    passwordHash: 'hash',
    displayName: opts.displayName,
    roleId: opts.roleId,
    outletIds: [],
    isActive: opts.isActive ?? true,
    lastLoginAt: null,
    pin: null,
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return repo.save(user);
}

function seedRole(repo: MongoRoleRepository, id: string, tenantId: string, name: string) {
  const role = Role.hydrate({
    id,
    tenantId,
    name,
    description: null,
    permissions: [],
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return repo.save(role);
}

function seedMembership(
  repo: MongoHubMembershipRepository,
  opts: { hubId: string; userId: string; role?: 'owner' | 'admin' | 'viewer' },
) {
  const membership = HubMembership.hydrate({
    id: `mem-${opts.hubId}-${opts.userId}`,
    hubId: opts.hubId,
    userId: opts.userId,
    role: opts.role ?? 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return repo.save(membership);
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

beforeAll(async () => {
  await setupTestDb();

  const tenantModel = mongoose.model('Tenant', TenantSchema);
  const hubModel = mongoose.model('Hub', HubSchema);
  const outletModel = mongoose.model('Outlet', OutletSchema);
  const warehouseModel = mongoose.model('Warehouse', WarehouseSchema);
  const shiftModel = mongoose.model('Shift', ShiftSchema);
  const paymentModel = mongoose.model('Payment', PaymentSchema);
  const userModel = mongoose.model('User', UserSchema);
  const roleModel = mongoose.model('Role', RoleSchema);
  const hubMembershipModel = mongoose.model('HubMembership', HubMembershipSchema);

  const tenantRepo = new MongoTenantRepository(tenantModel);
  const hubRepo = new MongoHubRepository(hubModel);
  const outletRepo = new MongoOutletRepository(outletModel);
  const warehouseRepo = new MongoWarehouseRepository(warehouseModel);
  const shiftRepo = new MongoShiftRepository(shiftModel);
  const paymentRepo = new MongoPaymentRepository(paymentModel);
  const userRepo = new MongoUserRepository(userModel);
  const roleRepo = new MongoRoleRepository(roleModel);
  const hubMembershipRepo = new MongoHubMembershipRepository(hubMembershipModel);
  const hubMembershipService = new HubMembershipService({
    hubMembershipRepository: hubMembershipRepo,
    hubRepository: hubRepo,
    tenantRepository: tenantRepo,
    userRepository: userRepo,
  });

  const hubService = new HubService(hubRepo, tenantRepo);
  const tenantService = new TenantService(tenantRepo);
  const outletService = new OutletService(outletRepo, warehouseRepo);
  const shiftService = new ShiftService(shiftRepo);
  const paymentService = new PaymentService(
    paymentRepo,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
  );

  const platformController = new PlatformController({
    hubService,
    tenantService,
    outletService,
    shiftService,
    paymentService,
    tenantRepository: tenantRepo,
    hubRepository: hubRepo,
    userRepository: userRepo,
    roleRepository: roleRepo,
    hubMembershipService,
  });

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/hubs', createHubRoutes(new HubController(hubService)));
  app.use('/api/outlets', createOutletRoutes(new OutletController(outletService)));
  app.use('/api/platform', createPlatformRoutes(platformController));
  app.use(errorHandler);

  ctx = {
    app,
    tenantRepo,
    hubRepo,
    outletRepo,
    shiftRepo,
    paymentRepo,
    userRepo,
    platformToken: generateTestToken({
      sub: 'platform-admin',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: PLATFORM_ROLE_PERMS,
    }),
    tenantToken: generateTestToken({ sub: 'owner-a', tenant: TENANT_A, permissions: ['platform.hubs.manage'] }),
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
});

const platformAuth = () => `Bearer ${ctx.platformToken}`;

describe('Terminal Center (/api/platform)', () => {
  it('health + hub list for platform session', async () => {
    const health = await request(ctx.app).get('/api/platform/health').set('Authorization', platformAuth());
    expect(health.status).toBe(200);
    expect(health.body.data.status).toBe('ok');

    const hubs = await request(ctx.app).get('/api/platform/hubs').set('Authorization', platformAuth());
    expect(hubs.status).toBe(200);
    expect(hubs.body.data).toHaveLength(1);
    expect(hubs.body.data[0].name).toBe('BCA Hospitality');
  });

  it('hub provisioning via /api/hubs reflected on platform views + tenant hubName', async () => {
    const created = await request(ctx.app)
      .post('/api/hubs')
      .set('Authorization', platformAuth())
      .send({ name: 'Tunas Group' });
    expect(created.status).toBe(201);

    const assign = await request(ctx.app)
      .post(`/api/hubs/${created.body.data.id}/tenants/${TENANT_A}`)
      .set('Authorization', platformAuth())
      .send({});
    expect(assign.status).toBe(200);

    const detail = await request(ctx.app)
      .get(`/api/platform/hubs/${created.body.data.id}`)
      .set('Authorization', platformAuth());
    expect(detail.status).toBe(200);
    expect(detail.body.data.tenantCount).toBe(1);
    expect(detail.body.data.tenants[0].id).toBe(TENANT_A);

    const tenant = await request(ctx.app)
      .get(`/api/platform/tenants/${TENANT_A}`)
      .set('Authorization', platformAuth());
    expect(tenant.status).toBe(200);
    expect(tenant.body.data.hubId).toBe(created.body.data.id);
    expect(tenant.body.data.hubName).toBe('Tunas Group');
  });

  it('lists tenants across hubs with hub/search filters + pagination', async () => {
    const all = await request(ctx.app).get('/api/platform/tenants').set('Authorization', platformAuth());
    expect(all.status).toBe(200);
    expect(all.body.data.total).toBe(2);
    expect(all.body.data.data).toHaveLength(2);
    expect(all.body.data.data.map((t: any) => t.hubName)).toEqual(['BCA Hospitality', 'BCA Hospitality']);

    const byHub = await request(ctx.app).get(`/api/platform/tenants?hubId=${HUB_1}`).set('Authorization', platformAuth());
    expect(byHub.body.data.total).toBe(2);

    const search = await request(ctx.app).get('/api/platform/tenants?search=alpha').set('Authorization', platformAuth());
    expect(search.body.data.total).toBe(1);
    expect(search.body.data.data[0].id).toBe(TENANT_A);

    const paginated = await request(ctx.app).get('/api/platform/tenants?limit=1&page=2').set('Authorization', platformAuth());
    expect(paginated.body.data.data).toHaveLength(1);
    expect(paginated.body.data.total).toBe(2);
  });

  it('reports hubName null for standalone tenants in the platform tenant list', async () => {
    await seedTenant(ctx.tenantRepo, TENANT_C, 'Gamma Kios', 'gamma-kios', null);

    const res = await request(ctx.app).get('/api/platform/tenants?search=gamma').set('Authorization', platformAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.data[0].hubId).toBeNull();
    expect(res.body.data.data[0].hubName).toBeNull();
  });

  it('searches users across tenants with search/tenant/hub/isActive filters and flags hub members', async () => {
    const roleRepo = new MongoRoleRepository(mongoose.model('Role', RoleSchema));
    const hubMembershipRepo = new MongoHubMembershipRepository(mongoose.model('HubMembership', HubMembershipSchema));

    await seedRole(roleRepo, 'role-owner-a', TENANT_A, 'Owner');
    await seedRole(roleRepo, 'role-cashier-b', TENANT_B, 'Cashier');
    await seedUser(ctx.userRepo, {
      id: 'user-budi',
      tenantId: TENANT_A,
      displayName: 'Budi Santoso',
      email: 'budi@alpha.test',
      roleId: 'role-owner-a',
    });
    await seedUser(ctx.userRepo, {
      id: 'user-sari',
      tenantId: TENANT_B,
      displayName: 'Sari Wijaya',
      email: 'sari@beta.test',
      roleId: 'role-cashier-b',
    });
    await seedUser(ctx.userRepo, {
      id: 'user-nonaktif',
      tenantId: TENANT_A,
      displayName: 'Dina Nonaktif',
      email: 'dina@alpha.test',
      roleId: 'role-owner-a',
      isActive: false,
    });
    await seedMembership(hubMembershipRepo, { hubId: HUB_1, userId: 'user-budi', role: 'owner' });

    const all = await request(ctx.app).get('/api/platform/users').set('Authorization', platformAuth());
    expect(all.status).toBe(200);
    expect(all.body.data.total).toBe(3);
    const byId = new Map<string, any>(all.body.data.data.map((u: any) => [u.id, u]));
    expect(byId.get('user-budi')).toMatchObject({
      displayName: 'Budi Santoso',
      tenantId: TENANT_A,
      tenantName: 'Alpha Kopi',
      roleName: 'Owner',
      isActive: true,
    });
    expect(byId.get('user-sari')).toMatchObject({ tenantName: 'Beta Resto', roleName: 'Cashier' });
    // Without a hub scope there is no membership context to report.
    expect(all.body.data.data.every((u: any) => u.isHubMember === false)).toBe(true);

    const bySearch = await request(ctx.app).get('/api/platform/users?search=sari').set('Authorization', platformAuth());
    expect(bySearch.body.data.total).toBe(1);
    expect(bySearch.body.data.data[0].id).toBe('user-sari');

    const byTenant = await request(ctx.app)
      .get(`/api/platform/users?tenantId=${TENANT_A}`)
      .set('Authorization', platformAuth());
    expect(byTenant.body.data.total).toBe(2);

    const byHub = await request(ctx.app).get(`/api/platform/users?hubId=${HUB_1}`).set('Authorization', platformAuth());
    expect(byHub.body.data.total).toBe(3);
    const byHubId = new Map<string, any>(byHub.body.data.data.map((u: any) => [u.id, u]));
    expect(byHubId.get('user-budi').isHubMember).toBe(true);
    expect(byHubId.get('user-sari').isHubMember).toBe(false);

    // A hub scope that resolves to zero tenants must return no user at all
    // (never "every tenant"), otherwise hub member picking leaks other tenants.
    await seedHub(ctx.hubRepo, 'hub-kosong', 'Hub Tanpa Tenant');
    const emptyHub = await request(ctx.app)
      .get('/api/platform/users?hubId=hub-kosong')
      .set('Authorization', platformAuth());
    expect(emptyHub.status).toBe(200);
    expect(emptyHub.body.data.total).toBe(0);
    expect(emptyHub.body.data.data).toHaveLength(0);

    const unknownTenant = await request(ctx.app)
      .get('/api/platform/users?tenantId=tenant-tidak-ada')
      .set('Authorization', platformAuth());
    expect(unknownTenant.body.data.total).toBe(0);

    const activeOnly = await request(ctx.app).get('/api/platform/users?isActive=true').set('Authorization', platformAuth());
    expect(activeOnly.body.data.total).toBe(2);

    // Regex metacharacters are escaped, not executed.
    const literal = await request(ctx.app)
      .get('/api/platform/users?search=' + encodeURIComponent('.*'))
      .set('Authorization', platformAuth());
    expect(literal.body.data.total).toBe(0);

    // Pagination
    const page2 = await request(ctx.app).get('/api/platform/users?limit=2&page=2').set('Authorization', platformAuth());
    expect(page2.body.data.data).toHaveLength(1);
    expect(page2.body.data.total).toBe(3);

    // RBAC: platform.audit.read alone is not enough
    const weakToken = generateTestToken({
      sub: 'platform-audit',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: ['platform.audit.read'],
    });
    const forbidden = await request(ctx.app).get('/api/platform/users').set('Authorization', `Bearer ${weakToken}`);
    expect(forbidden.status).toBe(403);

    const tenantScoped = await request(ctx.app).get('/api/platform/users').set('Authorization', ctx.tenantToken);
    expect(tenantScoped.status).toBe(401);
  });

  it('lists outlets across tenants with tenant/hub/isActive filters + tenantName', async () => {
    for (const [tenantId, name] of [
      [TENANT_A, 'Outlet Alpha 1'],
      [TENANT_A, 'Outlet Alpha 2'],
      [TENANT_B, 'Outlet Beta 1'],
    ] as const) {
      await ctx.outletRepo.save(Outlet.create({ tenantId, name, address: '', phone: '', warehouseId: null, isActive: true }));
    }
    await ctx.outletRepo.save(Outlet.create({ tenantId: TENANT_A, name: 'Outlet Nonaktif', address: '', phone: '', warehouseId: null, isActive: false }));

    const all = await request(ctx.app).get('/api/platform/outlets').set('Authorization', platformAuth());
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(4);
    expect(all.body.data.every((o: any) => o.tenantName === 'Alpha Kopi' || o.tenantName === 'Beta Resto')).toBe(true);

    const byTenant = await request(ctx.app).get(`/api/platform/outlets?tenantId=${TENANT_A}`).set('Authorization', platformAuth());
    expect(byTenant.body.data).toHaveLength(3);

    const active = await request(ctx.app).get('/api/platform/outlets?isActive=true').set('Authorization', platformAuth());
    expect(active.body.data).toHaveLength(3);
    expect(active.body.data.some((o: any) => o.name === 'Outlet Nonaktif')).toBe(false);
  });

  it('summarizes shifts and payments with hub scope', async () => {
    const open = Shift.open({ tenantId: TENANT_A, outletId: 'outlet-a-1', registerId: 'r1', cashierId: 'cashier-1', cashierName: 'Kasir', openingBalance: 0 });
    open.updateSales({ totalSales: 100000, cashSales: 80000, nonCashSales: 20000, totalTransactions: 3, paymentBreakdown: [] });
    await ctx.shiftRepo.save(open);

    const closed = Shift.open({ tenantId: TENANT_B, outletId: 'outlet-b-1', registerId: 'r2', cashierId: 'cashier-2', cashierName: 'Kasir', openingBalance: 0 });
    closed.updateSales({ totalSales: 50000, cashSales: 50000, nonCashSales: 0, totalTransactions: 1, paymentBreakdown: [] });
    closed.close(50000);
    await ctx.shiftRepo.save(closed);

    const shiftSummary = await request(ctx.app)
      .get(`/api/platform/shifts/summary?hubId=${HUB_1}`)
      .set('Authorization', platformAuth());
    expect(shiftSummary.status).toBe(200);
    expect(shiftSummary.body.data.totals.openShifts).toBe(1);
    expect(shiftSummary.body.data.totals.closedShifts).toBe(1);
    expect(shiftSummary.body.data.totals.totalSales).toBe(150000);
    expect(shiftSummary.body.data.totals.totalTransactions).toBe(4);
    const tenants = shiftSummary.body.data.tenants;
    expect(tenants).toHaveLength(2);
    expect(tenants.find((t: any) => t.tenantId === TENANT_A).tenantName).toBe('Alpha Kopi');
    expect(tenants.find((t: any) => t.tenantId === TENANT_A).openShifts).toBe(1);

    const cash = Payment.create({ tenantId: TENANT_A, orderId: 'o1', amount: 80000, status: 'pending', method: 'cash', referenceNumber: 'C-1', metadata: {}, paidAt: null });
    cash.complete();
    const qris = Payment.create({ tenantId: TENANT_A, orderId: 'o2', amount: 20000, status: 'pending', method: 'qris', referenceNumber: 'Q-1', metadata: {}, paidAt: null });
    qris.complete();
    await ctx.paymentRepo.save(cash);
    await ctx.paymentRepo.save(qris);

    const paySummary = await request(ctx.app)
      .get(`/api/platform/payments/summary?hubId=${HUB_1}`)
      .set('Authorization', platformAuth());
    expect(paySummary.status).toBe(200);
    expect(paySummary.body.data.totals.totalAmount).toBe(100000);
    expect(paySummary.body.data.totals.totalTransactions).toBe(2);
    const methods = paySummary.body.data.totals.methods;
    expect(methods.find((m: any) => m.method === 'cash').total).toBe(80000);
    expect(methods.find((m: any) => m.method === 'qris').total).toBe(20000);
    const payTenantA = paySummary.body.data.tenants.find((t: any) => t.tenantId === TENANT_A);
    expect(payTenantA.tenantName).toBe('Alpha Kopi');
    expect(payTenantA.totalAmount).toBe(100000);
  });

  it('rejects tenant sessions on platform routes', async () => {
    const res = await request(ctx.app).get('/api/platform/health').set('Authorization', `Bearer ${ctx.tenantToken}`);
    expect(res.status).toBe(401);
  });

  it('requires platform.reports.read for summaries', async () => {
    const restricted = generateTestToken({
      sub: 'platform-admin-2',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: ['platform.hubs.manage'],
    });
    const res = await request(ctx.app)
      .get('/api/platform/shifts/summary')
      .set('Authorization', `Bearer ${restricted}`);
    expect(res.status).toBe(403);
  });
});