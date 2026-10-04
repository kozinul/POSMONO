import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
import { HubMembership } from '../../src/core/hub/domain/HubMembership';

import { HubService } from '../../src/core/hub/application/services/HubService';
import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';
import { HubMemberAccessService } from '../../src/core/hub/application/services/HubMemberAccessService';
import { OutletService } from '../../src/core/outlet/application/services/OutletService';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { SubscriptionService } from '../../src/core/billing/application/services/SubscriptionService';
import { ReportAggregation } from '../../src/core/reporting/infrastructure/aggregation/ReportAggregation';
import { ReportService } from '../../src/core/reporting/application/services/ReportService';

import { MyHubController } from '../../src/core/hub/interfaces/http/controllers/MyHubController';
import { HubMembershipController } from '../../src/core/hub/interfaces/http/controllers/HubMembershipController';
import { createMyHubRoutes } from '../../src/core/hub/interfaces/http/routes/myhub.routes';
import { createHubContextRoutes } from '../../src/core/hub/interfaces/http/routes/hubcontext.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';

/**
 * Hub V2 Fase 23 — `GET /api/hub/outlet/overview`.
 *
 * The outlet view differs from the group view in one way that money depends on:
 * **sales are counted per outlet**. So the tests below are mostly about proving a
 * number on an outlet screen cannot be another outlet's number (or the tenant's
 * total), and about the guard chain that decides *which* hub the outlet belongs
 * to — `X-Outlet-Id` → outlet → tenant → `tenant.hubId` → membership.
 */
const HUB = 'hub-1';
const HUB_2 = 'hub-2';
const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';
const TENANT_NO_HUB = 'tenant-luar-hub';

const OUTLET_A = 'out-sanur';
const OUTLET_B = 'out-ubud';
const OUTLET_NO_HUB = 'out-luar';
const OUTLET_UNKNOWN = 'out-tidak-ada';

const OWNER = 'user-owner';
const MANAGER = 'user-manager';
const VIEWER = 'user-viewer';
const SUSPENDED_MEMBER = 'user-suspended';
const HUB2_OWNER = 'user-hub2-owner';
const OUTSIDER = 'user-outsider';
const NARROW = 'user-narrow';

let ctx: {
  app: Express;
  tenantRepo: MongoTenantRepository;
  hubRepo: MongoHubRepository;
  membershipRepo: MongoHubMembershipRepository;
  userRepo: MongoUserRepository;
  outletRepo: MongoOutletRepository;
  warehouseRepo: MongoWarehouseRepository;
  orderModel: Model<any>;
  shiftModel: Model<any>;
};

/**
 * No permissions in any token: if the outlet guard could be satisfied from the
 * JWT, it would be decorative. The hub role has to come from the membership row.
 */
function memberToken(userId: string, outletIds: string[] = []): string {
  return generateTestToken({ sub: userId, tenant: TENANT_A, permissions: [], outletIds });
}

function seedTenant(id: string, name: string, slug: string, hubId?: string | null) {
  return ctx.tenantRepo.save(
    Tenant.hydrate({
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
      config: {
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
        locale: 'id',
        qrisGatewayEnabled: true,
        qrisGatewayApiKey: 'rahasia-tenant-alpha',
      },
      billingEmail: `${slug}@test.local`,
      hubId: hubId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
}

function seedUser(id: string, name: string, email: string, tenantId = TENANT_A) {
  return ctx.userRepo.save(
    User.hydrate({
      id,
      tenantId,
      email,
      passwordHash: 'hash',
      displayName: name,
      roleId: `role-${tenantId}`,
      outletIds: [],
      isActive: true,
      lastLoginAt: null,
      pin: null,
      preferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
}

function seedOutlet(opts: { id: string; tenantId: string; name: string }) {
  const warehouse = Warehouse.hydrate({
    id: `wh-${opts.id}`,
    tenantId: opts.tenantId,
    outletId: opts.id,
    name: `Warehouse ${opts.name}`,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return ctx.warehouseRepo.save(warehouse).then(() =>
    ctx.outletRepo.save(
      Outlet.hydrate({
        id: opts.id,
        tenantId: opts.tenantId,
        name: opts.name,
        address: '',
        phone: '',
        warehouseId: `wh-${opts.id}`,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any),
    ),
  );
}

async function seedMembership(userId: string, hubId: string, role: string, status?: 'active' | 'suspended') {
  const membership = HubMembership.create({ hubId, userId, role: role as any });
  if (status === 'suspended') membership.suspend();
  return ctx.membershipRepo.save(membership);
}

async function seedOrder(opts: { id: string; tenantId: string; outletId: string | null; total: number; status?: string }) {
  await ctx.orderModel.create({
    _id: opts.id,
    tenantId: opts.tenantId,
    outletId: opts.outletId,
    orderNumber: opts.id,
    status: opts.status ?? 'paid',
    items: [],
    subtotal: opts.total,
    discount: 0,
    discountTotal: 0,
    tax: 0,
    total: opts.total,
    roundingAdjustment: 0,
    serviceCharge: 0,
    cashierId: 'cashier-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function seedShift(opts: { id: string; tenantId: string; outletId: string | null; status: 'open' | 'closed'; openedAt: Date }) {
  await ctx.shiftModel.create({
    _id: opts.id,
    tenantId: opts.tenantId,
    outletId: opts.outletId,
    registerId: 'register-default',
    cashierId: 'cashier-1',
    cashierName: 'Kasir',
    status: opts.status,
    openingBalance: 0,
    closingBalance: 0,
    physicalCash: 0,
    expectedCash: 0,
    totalCashPickups: 0,
    totalSales: 0,
    cashSales: 0,
    nonCashSales: 0,
    totalTransactions: 0,
    paymentBreakdown: [],
    cashPickups: [],
    carriedOverBills: [],
    openedAt: opts.openedAt,
    closedAt: opts.status === 'closed' ? opts.openedAt : null,
    createdAt: opts.openedAt,
    updatedAt: opts.openedAt,
  });
}

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
  const subscriptionRepo = new MongoSubscriptionRepository(c.model('Subscription', SubscriptionSchema));
  const planRepo = new MongoPlanRepository(c.model('Plan', PlanSchema));
  const orderModel = c.model('Order', OrderSchema);
  const shiftModel = c.model('Shift', ShiftSchema);

  const accessService = new HubMemberAccessService({
    accessRepository: {
      findByHubAndUser: async () => [],
      findByUser: async () => [],
      findByHubUserTenant: async () => null,
      save: async () => undefined,
      delete: async () => undefined,
    } as any,
    hubMembershipRepository: membershipRepo,
    hubRepository: hubRepo,
    tenantRepository: tenantRepo,
  });

  const hubMembershipService = new HubMembershipService({
    hubMembershipRepository: membershipRepo,
    hubRepository: hubRepo,
    tenantRepository: tenantRepo,
    userRepository: userRepo,
  });

  const shiftService = new ShiftService(shiftRepo);
  const reportService = new ReportService(
    {} as any,
    shiftRepo,
    {} as any,
    new ReportAggregation(
      orderModel,
      shiftModel,
      c.model('Product', new mongoose.Schema({ _id: String })) as any,
      paymentRepo as any,
    ),
  );

  const controller = new MyHubController({
    accessService,
    hubService: new HubService(hubRepo, tenantRepo),
    membersSource: hubMembershipService,
    outletsSource: new OutletService(outletRepo, warehouseRepo),
    activitySource: shiftService,
    salesSource: reportService,
    subscriptionSource: new SubscriptionService(subscriptionRepo, planRepo, tenantRepo),
    outletSalesSource: reportService,
  });

  const membershipController = new HubMembershipController(hubMembershipService, undefined, accessService);

  const app = express();
  app.use(express.json());
  // The real route factory, so `authenticate` + `resolveOutlet` +
  // `requireHubPermissionForOutlet` run in the order production mounts them.
  app.use('/api/hub', createMyHubRoutes(controller, accessService, { outlets: outletRepo, tenants: tenantRepo }));
  app.use('/api/hub-context', createHubContextRoutes(membershipController));
  app.use(errorHandler);

  ctx = {
    app,
    tenantRepo,
    hubRepo,
    membershipRepo,
    userRepo,
    outletRepo,
    warehouseRepo,
    orderModel,
    shiftModel,
  };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();

  await ctx.hubRepo.save(makeHub({ id: HUB, name: 'BCA Hospitality', code: 'BCA' }));
  await ctx.hubRepo.save(makeHub({ id: HUB_2, name: 'Mandiri Group', code: 'MANDIRI' }));

  await seedTenant(TENANT_A, 'Alpha Kopi', 'alpha-kopi', HUB);
  await seedTenant(TENANT_B, 'Beta Resto', 'beta-resto', HUB);
  await seedTenant(TENANT_NO_HUB, 'Gamma Cafe', 'gamma-cafe', null);

  for (const userId of [OWNER, MANAGER, VIEWER, SUSPENDED_MEMBER, HUB2_OWNER, OUTSIDER, NARROW]) {
    await seedUser(userId, userId, `${userId}@test.local`);
  }

  await seedOutlet({ id: OUTLET_A, tenantId: TENANT_A, name: 'Sanur' });
  await seedOutlet({ id: OUTLET_B, tenantId: TENANT_A, name: 'Ubud' });
  await seedOutlet({ id: OUTLET_NO_HUB, tenantId: TENANT_NO_HUB, name: 'Luar' });

  await seedMembership(OWNER, HUB, 'owner');
  await seedMembership(MANAGER, HUB, 'manager');
  await seedMembership(VIEWER, HUB, 'viewer');
  await seedMembership(SUSPENDED_MEMBER, HUB, 'owner', 'suspended');
  await seedMembership(HUB2_OWNER, HUB_2, 'owner');
});

const asUser = (userId: string, outletIds: string[] = []) => `Bearer ${memberToken(userId, outletIds)}`;
const forOutlet = (req: request.Test, outletId: string) => req.set('X-Outlet-Id', outletId);

describe('Hub outlet view (GET /api/hub/outlet/overview) — Fase 23', () => {
  describe('DENY — authentication', () => {
    it('401 without a token', async () => {
      await request(ctx.app).get('/api/hub/outlet/overview').expect(401);
    });
  });

  describe('DENY — the outlet context', () => {
    it('400 when no outlet is selected — the header is the only source of truth', async () => {
      const res = await request(ctx.app)
        .get('/api/hub/outlet/overview')
        .set('Authorization', asUser(OWNER))
        .expect(400);

      expect(res.body.error.message).toMatch(/outlet/i);
    });

    it('404 for an outlet that does not exist', async () => {
      await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_UNKNOWN,
      ).expect(404);
    });

    it('404 when the outlet belongs to a tenant with no hub', async () => {
      // "There is no hub behind this outlet" must read like "that hub does not
      // exist" — otherwise the endpoint becomes a hub-id oracle.
      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_NO_HUB,
      ).expect(404);

      expect(res.body.error.message).toMatch(/hub/i);
    });

    it('403 when the selected outlet is outside the user outlet scope', async () => {
      await forOutlet(
        request(ctx.app)
          .get('/api/hub/outlet/overview')
          .set('Authorization', asUser(NARROW, [OUTLET_B])),
        OUTLET_A,
      ).expect(403);
    });
  });

  describe('DENY — membership', () => {
    it('403 for a signed-in non-member', async () => {
      await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OUTSIDER)),
        OUTLET_A,
      ).expect(403);
    });

    it('403 for a suspended member — the tombstone is not a surface', async () => {
      await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(SUSPENDED_MEMBER)),
        OUTLET_A,
      ).expect(403);
    });

    it('403 across hubs: a hub-2 member cannot view an outlet of hub-1', async () => {
      await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(HUB2_OWNER)),
        OUTLET_A,
      ).expect(403);
    });

    it('403 for a platform admin without a membership — no bypass', async () => {
      const platformToken = generateTestToken({
        sub: 'platform-admin',
        tenant: 'platform',
        role: 'platform-super-admin',
        permissions: PLATFORM_ROLE_PERMS,
      });
      await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', `Bearer ${platformToken}`),
        OUTLET_A,
      ).expect(403);
    });
  });

  describe('DENY — the narrowed viewer role', () => {
    it('403 for viewer, who has no hub.reports.read', async () => {
      await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(VIEWER)),
        OUTLET_A,
      ).expect(403);
    });
  });

  describe('ALLOW — the outlet screen', () => {
    it('is not swallowed by the /:hubId/overview route', async () => {
      // Route order is load-bearing here: `/:hubId/overview` would happily read
      // `hubId = 'outlet'` and answer "Hub with id outlet not found".
      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);

      expect(res.body.data.outlet.id).toBe(OUTLET_A);
      expect(res.body.data.hub.id).toBe(HUB);
    });

    it('names the outlet, its tenant and its hub', async () => {
      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);

      expect(res.body.data.outlet).toMatchObject({
        id: OUTLET_A,
        name: 'Sanur',
        tenantId: TENANT_A,
        tenantName: 'Alpha Kopi',
        isActive: true,
      });
      expect(res.body.data.hub).toMatchObject({ id: HUB, code: 'BCA' });
    });

    it('returns the role and permissions the server actually applied', async () => {
      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(MANAGER)),
        OUTLET_A,
      ).expect(200);

      // The client gates its tabs on this, not on a hub it guessed.
      expect(res.body.data.hub.role).toBe('manager');
      expect(res.body.data.hub.permissions).toContain('hub.reports.read');
    });

    it('counts only the selected outlet revenue, never the tenant total', async () => {
      await seedOrder({ id: 'ord-a1', tenantId: TENANT_A, outletId: OUTLET_A, total: 100_000 });
      await seedOrder({ id: 'ord-a2', tenantId: TENANT_A, outletId: OUTLET_A, total: 150_000 });
      await seedOrder({ id: 'ord-b1', tenantId: TENANT_A, outletId: OUTLET_B, total: 900_000 });
      // Pre-outlet history of the same tenant: belongs to no outlet screen.
      await seedOrder({ id: 'ord-legacy', tenantId: TENANT_A, outletId: null, total: 700_000 });

      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);

      expect(res.body.data.sales.total).toBe(250_000);
      expect(res.body.data.sales.transactions).toBe(2);
    });

    it('gives a different number for the sibling outlet of the same tenant', async () => {
      await seedOrder({ id: 'ord-a1', tenantId: TENANT_A, outletId: OUTLET_A, total: 100_000 });
      await seedOrder({ id: 'ord-b1', tenantId: TENANT_A, outletId: OUTLET_B, total: 900_000 });

      const sanur = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);
      const ubud = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_B,
      ).expect(200);

      expect(sanur.body.data.sales.total).toBe(100_000);
      expect(ubud.body.data.sales.total).toBe(900_000);
    });

    it('keeps revenue out of a voided order', async () => {
      await seedOrder({ id: 'ord-void', tenantId: TENANT_A, outletId: OUTLET_A, total: 500_000, status: 'voided' });

      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);

      expect(res.body.data.sales.total).toBe(0);
      expect(res.body.data.sales.transactions).toBe(0);
    });

    it('never shows another tenant revenue, even inside the same hub', async () => {
      await seedOrder({ id: 'ord-b-tenant', tenantId: TENANT_B, outletId: null, total: 4_000_000 });

      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);

      expect(res.body.data.sales.total).toBe(0);
    });

    it('reports an open shift for that outlet and nothing else', async () => {
      await seedShift({
        id: 'shift-a',
        tenantId: TENANT_A,
        outletId: OUTLET_A,
        status: 'open',
        openedAt: new Date(),
      });
      await seedShift({
        id: 'shift-b',
        tenantId: TENANT_A,
        outletId: OUTLET_B,
        status: 'open',
        openedAt: new Date(),
      });

      const sanur = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);
      const ubud = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_B,
      ).expect(200);

      expect(sanur.body.data.operational).toMatchObject({ hasOpenShift: true, openShifts: 1, isStale: false });
      expect(ubud.body.data.operational).toMatchObject({ hasOpenShift: true, openShifts: 1 });
    });

    it('flags an outlet that never opened a shift as stale instead of hiding it', async () => {
      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);

      expect(res.body.data.operational).toMatchObject({
        hasOpenShift: false,
        openShifts: 0,
        lastShiftAt: null,
        isStale: true,
      });
    });

    it('does not count a closed shift as open', async () => {
      await seedShift({
        id: 'shift-closed',
        tenantId: TENANT_A,
        outletId: OUTLET_A,
        status: 'closed',
        openedAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);

      expect(res.body.data.operational.hasOpenShift).toBe(false);
      // Closed an hour ago: recent enough not to be stale.
      expect(res.body.data.operational.isStale).toBe(false);
      expect(res.body.data.operational.idleHours).toBe(1);
    });

    it('passes the requested date range through to the read model', async () => {
      await seedOrder({ id: 'ord-old', tenantId: TENANT_A, outletId: OUTLET_A, total: 300_000 });

      const res = await forOutlet(
        request(ctx.app)
          .get('/api/hub/outlet/overview?dateFrom=2026-01-01&dateTo=2026-01-02')
          .set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);

      expect(res.body.data.dateFrom).toMatch(/^2026-01-01/);
      expect(res.body.data.dateTo).toMatch(/^2026-01-02/);
      // Outside the window.
      expect(res.body.data.sales.total).toBe(0);
    });

    it('rejects a malformed date range with 400', async () => {
      await forOutlet(
        request(ctx.app)
          .get('/api/hub/outlet/overview?dateFrom=bukan-tanggal')
          .set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(400);
    });

    it('counts hub members, not outlet members', async () => {
      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);

      expect(res.body.data.members.total).toBeGreaterThan(0);
    });

    it('does not leak the tenant QRIS credentials in the response', async () => {
      const res = await forOutlet(
        request(ctx.app).get('/api/hub/outlet/overview').set('Authorization', asUser(OWNER)),
        OUTLET_A,
      ).expect(200);

      expect(JSON.stringify(res.body)).not.toContain('rahasia-tenant-alpha');
      expect(JSON.stringify(res.body)).not.toContain('qrisGatewayApiKey');
    });
  });
});