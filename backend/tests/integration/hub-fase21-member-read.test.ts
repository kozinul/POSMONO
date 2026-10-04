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

const HUB = 'hub-1';
const HUB_2 = 'hub-2';
const HUB_SUSPENDED = 'hub-suspended';
const HUB_ARCHIVED = 'hub-archived';
const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';
const TENANT_OUTSIDE = 'tenant-luar-hub';

const OWNER = 'user-owner';
const ADMIN = 'user-admin';
const MANAGER = 'user-manager';
const VIEWER = 'user-viewer';
const SUSPENDED_MEMBER = 'user-suspended-member';
const HUB2_OWNER = 'user-hub2-owner';
const OUTSIDER = 'user-outsider';

let ctx: {
  app: Express;
  tenantRepo: MongoTenantRepository;
  hubRepo: MongoHubRepository;
  membershipRepo: MongoHubMembershipRepository;
  userRepo: MongoUserRepository;
  outletRepo: MongoOutletRepository;
  warehouseRepo: MongoWarehouseRepository;
  orderModel: Model<any>;
  accessService: HubMemberAccessService;
};

/**
 * Every member token below carries **no permissions on purpose**.
 *
 * If any of these tests could be satisfied by the JWT's permission list, the
 * whole hub guard would be decorative — the point of the `hub.*` namespace is
 * that it is absent from tokens and comes from the membership row instead.
 */
function memberToken(userId: string): string {
  return generateTestToken({ sub: userId, tenant: TENANT_A, permissions: [] });
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
      // The member-facing tenant projection must not carry this: it holds the
      // tenant's QRIS gateway credentials.
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

async function seedOrder(opts: { id: string; tenantId: string; total: number; status?: string }) {
  await ctx.orderModel.create({
    _id: opts.id,
    tenantId: opts.tenantId,
    outletId: null,
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
      c.model('Shift', ShiftSchema),
      c.model('Product', new mongoose.Schema({ _id: String })) as any,
      paymentRepo as any,
    ),
  );

  // Named deps object, like `PlatformController`: positional wiring is what
  // shifted `taxService` into the wrong slot in Fase 17's incident.
  const controller = new MyHubController({
    accessService,
    hubService: new HubService(hubRepo, tenantRepo),
    membersSource: hubMembershipService,
    outletsSource: new OutletService(outletRepo, warehouseRepo),
    activitySource: shiftService,
    salesSource: reportService,
    subscriptionSource: new SubscriptionService(subscriptionRepo, planRepo, tenantRepo),
  });

  const membershipController = new HubMembershipController(hubMembershipService, undefined, accessService);

  const app = express();
  app.use(express.json());
  // The real route factory, so `authenticate` + `requireHubPermission` are
  // exercised in the same order production mounts them.
  app.use('/api/hub', createMyHubRoutes(controller, accessService, { outlets: outletRepo, tenants: tenantRepo }));
  app.use('/api/hub-context', createHubContextRoutes(membershipController));
  app.use(errorHandler);

  ctx = { app, tenantRepo, hubRepo, membershipRepo, userRepo, outletRepo, warehouseRepo, orderModel, accessService };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();

  await ctx.hubRepo.save(makeHub({ id: HUB, name: 'BCA Hospitality', code: 'BCA' }));
  await ctx.hubRepo.save(makeHub({ id: HUB_2, name: 'Mandiri Group', code: 'MANDIRI' }));
  await ctx.hubRepo.save(makeHub({ id: HUB_SUSPENDED, name: 'Suspended Group', code: 'SUSP', status: 'suspended' }));
  await ctx.hubRepo.save(makeHub({ id: HUB_ARCHIVED, name: 'Archived Group', code: 'ARCH', status: 'archived' }));

  await seedTenant(TENANT_A, 'Alpha Kopi', 'alpha-kopi', HUB);
  await seedTenant(TENANT_B, 'Beta Resto', 'beta-resto', HUB);
  await seedTenant(TENANT_OUTSIDE, 'Gamma Cafe', 'gamma-cafe', null);

  for (const userId of [OWNER, ADMIN, MANAGER, VIEWER, SUSPENDED_MEMBER, HUB2_OWNER, OUTSIDER]) {
    await seedUser(userId, userId, `${userId}@test.local`);
  }

  await seedMembership(OWNER, HUB, 'owner');
  await seedMembership(ADMIN, HUB, 'admin');
  await seedMembership(MANAGER, HUB, 'manager');
  await seedMembership(VIEWER, HUB, 'viewer');
  await seedMembership(SUSPENDED_MEMBER, HUB, 'owner', 'suspended');
  await seedMembership(HUB2_OWNER, HUB_2, 'owner');
  await seedMembership(OWNER, HUB_SUSPENDED, 'owner');
  await seedMembership(OWNER, HUB_ARCHIVED, 'owner');
});

const asUser = (userId: string) => `Bearer ${memberToken(userId)}`;

describe('Hub member read API (GET /api/hub) — Fase 21', () => {
  describe('DENY — authentication and membership', () => {
    it('401 without a token', async () => {
      await request(ctx.app).get('/api/hub/me/hubs').expect(401);
      await request(ctx.app).get(`/api/hub/${HUB}/tenants`).expect(401);
    });

    it('403 for a signed-in non-member', async () => {
      await request(ctx.app).get(`/api/hub/${HUB}`).set('Authorization', asUser(OUTSIDER)).expect(403);
      await request(ctx.app).get(`/api/hub/${HUB}/tenants`).set('Authorization', asUser(OUTSIDER)).expect(403);
      await request(ctx.app).get(`/api/hub/${HUB}/members`).set('Authorization', asUser(OUTSIDER)).expect(403);
      await request(ctx.app).get(`/api/hub/${HUB}/overview`).set('Authorization', asUser(OUTSIDER)).expect(403);
    });

    it('403 for a suspended member — the tombstone is not a surface', async () => {
      await request(ctx.app).get(`/api/hub/${HUB}`).set('Authorization', asUser(SUSPENDED_MEMBER)).expect(403);
      await request(ctx.app).get(`/api/hub/${HUB}/tenants`).set('Authorization', asUser(SUSPENDED_MEMBER)).expect(403);
      await request(ctx.app).get(`/api/hub/${HUB}/overview`).set('Authorization', asUser(SUSPENDED_MEMBER)).expect(403);
    });

    it('403 for a member of a hub that is suspended or archived', async () => {
      await request(ctx.app).get(`/api/hub/${HUB_SUSPENDED}/tenants`).set('Authorization', asUser(OWNER)).expect(403);
      await request(ctx.app).get(`/api/hub/${HUB_ARCHIVED}/tenants`).set('Authorization', asUser(OWNER)).expect(403);
    });

    it('404 for an unknown hub, before any membership question', async () => {
      await request(ctx.app).get('/api/hub/hub-tidak-ada').set('Authorization', asUser(OWNER)).expect(404);
      await request(ctx.app)
        .get('/api/hub/hub-tidak-ada/tenants')
        .set('Authorization', asUser(OWNER))
        .expect(404);
    });

    it('403 across hubs: a hub-1 member cannot read hub-2', async () => {
      await request(ctx.app).get(`/api/hub/${HUB_2}/tenants`).set('Authorization', asUser(OWNER)).expect(403);
      await request(ctx.app).get(`/api/hub/${HUB_2}/overview`).set('Authorization', asUser(MANAGER)).expect(403);
    });

    it('403 for a platform admin without a membership — no bypass', async () => {
      const platformToken = generateTestToken({
        sub: 'platform-admin',
        tenant: 'platform',
        role: 'platform-super-admin',
        permissions: PLATFORM_ROLE_PERMS,
      });
      await request(ctx.app)
        .get(`/api/hub/${HUB}/tenants`)
        .set('Authorization', `Bearer ${platformToken}`)
        .expect(403);
      // ...while a platform admin who *is* a member reads it normally, which
      // proves the gate is membership-based rather than role-string-based.
      const platformMember = generateTestToken({
        sub: OWNER,
        tenant: 'platform',
        role: 'platform-super-admin',
        permissions: PLATFORM_ROLE_PERMS,
      });
      await request(ctx.app)
        .get(`/api/hub/${HUB}/tenants`)
        .set('Authorization', `Bearer ${platformMember}`)
        .expect(200);
    });
  });

  describe('DENY — viewer narrowed to the hub profile', () => {
    it('403 for viewer on tenants, members and overview', async () => {
      await request(ctx.app).get(`/api/hub/${HUB}/tenants`).set('Authorization', asUser(VIEWER)).expect(403);
      await request(ctx.app).get(`/api/hub/${HUB}/members`).set('Authorization', asUser(VIEWER)).expect(403);
      await request(ctx.app).get(`/api/hub/${HUB}/overview`).set('Authorization', asUser(VIEWER)).expect(403);
    });

    it('200 for viewer on the hub profile, with no other permission attached', async () => {
      const res = await request(ctx.app)
        .get(`/api/hub/${HUB}`)
        .set('Authorization', asUser(VIEWER))
        .expect(200);

      expect(res.body.data).toMatchObject({ id: HUB, code: 'BCA', role: 'viewer' });
      expect(res.body.data.permissions).toEqual(['hub.read']);
    });
  });

  describe('DENY — tenant configuration must not leak to members', () => {
    it('returns a projected tenant row without config', async () => {
      const res = await request(ctx.app)
        .get(`/api/hub/${HUB}/tenants`)
        .set('Authorization', asUser(MANAGER))
        .expect(200);

      const alpha = res.body.data.find((t: any) => t.id === TENANT_A);
      expect(alpha).toMatchObject({ id: TENANT_A, name: 'Alpha Kopi', status: 'trial' });
      expect(alpha.config).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('rahasia-tenant-alpha');
    });
  });

  describe('ALLOW — the hub member surface', () => {
    it('lists only the active hubs the member belongs to', async () => {
      const res = await request(ctx.app)
        .get('/api/hub/me/hubs')
        .set('Authorization', asUser(OWNER))
        .expect(200);

      // hub-2 (no membership), the suspended hub and the archived hub are all
      // absent: a non-operational hub is not a surface, and hub-2 is someone
      // else's.
      expect(res.body.data.map((h: any) => h.id)).toEqual([HUB]);
      expect(res.body.data[0]).toMatchObject({ code: 'BCA', role: 'owner' });
      expect(res.body.data[0].permissions).toContain('hub.tenants.manage');
    });

    it('returns an empty list for a non-member instead of 403', async () => {
      const res = await request(ctx.app)
        .get('/api/hub/me/hubs')
        .set('Authorization', asUser(OUTSIDER))
        .expect(200);
      expect(res.body.data).toEqual([]);
    });

    it('agrees with /api/hub-context/me about which hubs the member is in', async () => {
      const [mine, context] = await Promise.all([
        request(ctx.app).get('/api/hub/me/hubs').set('Authorization', asUser(VIEWER)).expect(200),
        request(ctx.app).get('/api/hub-context/me').set('Authorization', asUser(VIEWER)).expect(200),
      ]);
      // Two endpoints describing "my hubs" must not disagree; they now share one
      // owner (`HubMemberAccessService.listMyHubs`).
      expect(mine.body.data.map((h: any) => h.id).sort()).toEqual(
        context.body.data.hubs.map((h: any) => h.id).sort(),
      );
    });

    it('reports each role only the permissions it actually has', async () => {
      const rows: Record<string, string[]> = {};
      for (const [userId, role] of [
        [ADMIN, 'admin'],
        [MANAGER, 'manager'],
        [VIEWER, 'viewer'],
      ] as const) {
        const res = await request(ctx.app)
          .get(`/api/hub/${HUB}`)
          .set('Authorization', asUser(userId))
          .expect(200);
        expect(res.body.data.role).toBe(role);
        rows[role] = res.body.data.permissions;
      }
      expect(rows.admin).toContain('hub.members.manage');
      expect(rows.admin).not.toContain('hub.tenants.manage');
      expect(rows.manager).toContain('hub.members.read');
      expect(rows.manager).not.toContain('hub.members.manage');
      expect(rows.viewer).toEqual(['hub.read']);
    });

    it('lists the hub tenants for owner, admin and manager', async () => {
      for (const userId of [OWNER, ADMIN, MANAGER]) {
        const res = await request(ctx.app)
          .get(`/api/hub/${HUB}/tenants`)
          .set('Authorization', asUser(userId))
          .expect(200);
        expect(res.body.data.map((t: any) => t.id).sort()).toEqual([TENANT_A, TENANT_B]);
      }
    });

    it('lists hub members', async () => {
      const res = await request(ctx.app)
        .get(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(OWNER))
        .expect(200);
      expect(res.body.data.map((m: any) => m.userId).sort()).toEqual(
        [OWNER, ADMIN, MANAGER, VIEWER, SUSPENDED_MEMBER].sort(),
      );
    });

    it('serves the overview scoped to the hub, reusing the Terminal Center read model', async () => {
      await seedOutlet({ id: 'outlet-a-1', tenantId: TENANT_A, name: 'Sanur' });
      await seedOrder({ id: 'ord-in', tenantId: TENANT_A, total: 120_000 });
      await seedOrder({ id: 'ord-out', tenantId: TENANT_OUTSIDE, total: 999_999_999 });

      const res = await request(ctx.app)
        .get(`/api/hub/${HUB}/overview`)
        .set('Authorization', asUser(MANAGER))
        .expect(200);

      const { data } = res.body;
      expect(data.hub.id).toBe(HUB);
      expect(data.counts).toMatchObject({ tenants: 2, outlets: 1, members: 5 });
      // The outside tenant's revenue is not in the hub's numbers.
      expect(data.sales.total).toBe(120_000);
      expect(data.sales.byTenant.map((t: any) => t.tenantId).sort()).toEqual([TENANT_A, TENANT_B]);
    });

    it('honours the date range on the member overview', async () => {
      const today = new Date();
      const iso = today.toISOString().slice(0, 10);
      await seedOrder({ id: 'ord-today', tenantId: TENANT_A, total: 50_000 });
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      await ctx.orderModel.create({
        _id: 'ord-yesterday',
        tenantId: TENANT_A,
        outletId: null,
        orderNumber: 'ord-yesterday',
        status: 'paid',
        items: [],
        subtotal: 700_000,
        discount: 0,
        discountTotal: 0,
        tax: 0,
        total: 700_000,
        roundingAdjustment: 0,
        serviceCharge: 0,
        cashierId: 'cashier-1',
        createdAt: yesterday,
        updatedAt: yesterday,
      });

      const inRange = await request(ctx.app)
        .get(`/api/hub/${HUB}/overview?dateFrom=${iso}&dateTo=${iso}`)
        .set('Authorization', asUser(MANAGER))
        .expect(200);
      expect(inRange.body.data.sales.total).toBe(50_000);

      const badRange = await request(ctx.app)
        .get(`/api/hub/${HUB}/overview?dateFrom=bukan-tanggal`)
        .set('Authorization', asUser(MANAGER))
        .expect(400);
      expect(badRange.body.error.message).toContain('YYYY-MM-DD');
    });
  });
});