import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import request from 'supertest';
import express, { Express, Request, Response, NextFunction, Router } from 'express';
import jwt from 'jsonwebtoken';
import { makeHub } from '../fixtures/hub.fixtures';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { TEST_SECRET } from '../helpers/auth';

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { HubMembershipSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMembershipSchema';
import { HubMemberTenantAccessSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMemberTenantAccessSchema';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { SessionSchema } from '../../src/core/identity/infrastructure/persistence/schemas/SessionSchema';
import { OutletSchema } from '../../src/core/outlet/infrastructure/persistence/schemas/OutletSchema';

import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { MongoHubRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubRepository';
import { MongoHubMembershipRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMembershipRepository';
import { MongoHubMemberTenantAccessRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMemberTenantAccessRepository';
import { MongoUserRepository } from '../../src/core/identity/infrastructure/persistence/MongoUserRepository';
import { MongoOutletRepository } from '../../src/core/outlet/infrastructure/persistence/MongoOutletRepository';

import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { Hub } from '../../src/core/hub/domain/Hub';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { User } from '../../src/core/identity/domain/User';
import { Outlet } from '../../src/core/outlet/domain/Outlet';

import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';
import { HubMemberAccessService } from '../../src/core/hub/application/services/HubMemberAccessService';
import { AuthService } from '../../src/core/identity/application/services/AuthService';
import { TokenService } from '../../src/core/identity/application/services/TokenService';
import { PasswordService } from '../../src/core/identity/domain/services/PasswordService';
import { SessionService } from '../../src/core/identity/application/services/SessionService';

import { HubMembershipController } from '../../src/core/hub/interfaces/http/controllers/HubMembershipController';
import { AuthController } from '../../src/core/identity/interfaces/http/controllers/AuthController';
import { createHubMembershipRoutes } from '../../src/core/hub/interfaces/http/routes/hubmembership.routes';
import { createHubContextRoutes } from '../../src/core/hub/interfaces/http/routes/hubcontext.routes';
import { createAuthRoutes } from '../../src/core/identity/interfaces/http/routes/auth.routes';
import { tenantContext } from '../../src/@shared/interfaces/middleware/tenantContext';
import { authenticate } from '../../src/@shared/interfaces/middleware/authenticate';
import { authorize } from '../../src/@shared/interfaces/middleware/authorize';
import { resolveOutlet } from '../../src/@shared/interfaces/middleware/resolveOutlet';
import { asyncHandler } from '../../src/@shared/interfaces/middleware/asyncHandler';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { PERMISSIONS } from '@posmono/shared';

const HUB = 'hub-1';
const HUB_2 = 'hub-2';
const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';
const TENANT_C = 'tenant-gamma';
const MEMBER = 'member-user';
const PLATFORM_ADMIN = 'platform-admin';
const OUTLET_A1 = 'outlet-a-1';
const OUTLET_A2 = 'outlet-a-2';
const OUTLET_B1 = 'outlet-b-1';

let ctx: {
  app: Express;
  tenantRepo: InstanceType<typeof MongoTenantRepository>;
  hubRepo: InstanceType<typeof MongoHubRepository>;
  membershipRepo: InstanceType<typeof MongoHubMembershipRepository>;
  accessRepo: InstanceType<typeof MongoHubMemberTenantAccessRepository>;
  userRepo: InstanceType<typeof MongoUserRepository>;
  outletRepo: InstanceType<typeof MongoOutletRepository>;
  accessService: HubMemberAccessService;
  platformToken: string;
  memberToken: string;
};

function platformToken() {
  return jwt.sign(
    {
      sub: PLATFORM_ADMIN,
      tenant: 'platform',
      role: 'platform-super-admin',
      roleName: 'Platform Super Admin',
      permissions: [PERMISSIONS.PLATFORM_HUBS_MANAGE],
      outletIds: [],
    },
    TEST_SECRET,
    { expiresIn: '15m' },
  );
}

/**
 * Token for the hub member. The user's own tenant role is deliberately empty:
 * Fase 17 derives cross-tenant sessions from the grant, never from the role the
 * user happens to hold in their home tenant.
 */
function memberToken() {
  return jwt.sign(
    {
      sub: MEMBER,
      tenant: TENANT_A,
      role: 'user',
      roleName: 'Member',
      permissions: [],
      outletIds: [],
    },
    TEST_SECRET,
    { expiresIn: '15m' },
  );
}

/** Token for `owner-a`, the user added as a hub member in the D3 baseline test. */
function ownerAToken() {
  return jwt.sign(
    { sub: 'owner-a', tenant: TENANT_A, role: 'user', roleName: 'Owner', permissions: [], outletIds: [] },
    TEST_SECRET,
    { expiresIn: '15m' },
  );
}

function seedTenant(repo: InstanceType<typeof MongoTenantRepository>, id: string, name: string, hubId?: string) {
  return repo.save(
    Tenant.hydrate({
      id,
      name,
      slug: id,
      domain: null,
      ownerId: `owner-${id}`,
      plan: 'trial',
      status: 'trial',
      businessType: 'restaurant',
      modules: ['pos'],
      databaseName: `posmono_${id}`,
      config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
      billingEmail: `${id}@test.local`,
      hubId: hubId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
}

function seedOutlet(repo: InstanceType<typeof MongoOutletRepository>, id: string, tenantId: string, name: string) {
  return repo.save(
    Outlet.hydrate({
      id,
      tenantId,
      name,
      address: '',
      phone: '',
      warehouseId: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
}

beforeAll(async () => {
  await setupTestDb();

  const tenantModel = mongoose.model('Tenant', TenantSchema);
  const hubModel = mongoose.model('Hub', HubSchema);
  const membershipModel = mongoose.model('HubMembership', HubMembershipSchema);
  const accessModel = mongoose.model('HubMemberTenantAccess', HubMemberTenantAccessSchema);
  const userModel = mongoose.model('User', UserSchema);
  const sessionModel = mongoose.model('Session', SessionSchema);
  const outletModel = mongoose.model('Outlet', OutletSchema);

  const tenantRepo = new MongoTenantRepository(tenantModel);
  const hubRepo = new MongoHubRepository(hubModel);
  const membershipRepo = new MongoHubMembershipRepository(membershipModel);
  const accessRepo = new MongoHubMemberTenantAccessRepository(accessModel);
  const userRepo = new MongoUserRepository(userModel);
  const outletRepo = new MongoOutletRepository(outletModel);

  const accessService = new HubMemberAccessService({
    accessRepository: accessRepo,
    hubMembershipRepository: membershipRepo,
    hubRepository: hubRepo,
    tenantRepository: tenantRepo,
    outletRepository: outletRepo,
  });

  const hubMembershipService = new HubMembershipService({
    hubMembershipRepository: membershipRepo,
    hubRepository: hubRepo,
    tenantRepository: tenantRepo,
    userRepository: userRepo,
    accessService,
  });

  const authService = new AuthService(
    userRepo,
    new TokenService(),
    new PasswordService(),
    new SessionService(sessionModel),
    undefined,
    hubMembershipService,
    accessService,
  );

  const controller = new HubMembershipController(hubMembershipService, undefined, accessService);

  const app = express();
  app.use(express.json());
  app.use(tenantContext);
  app.use('/api/auth', createAuthRoutes(new AuthController(authService)));
  app.use('/api/hub-memberships', createHubMembershipRoutes(controller));
  app.use('/api/hub-context', createHubContextRoutes(controller));

  // Probe route wired with the real middleware chain so the outlet DENY is
  // asserted through the same `authenticate → resolveOutlet` path production uses.
  const probe = Router();
  probe.get(
    '/probe',
    authenticate,
    resolveOutlet,
    asyncHandler(async (req: Request, res: Response) => {
      res.json({ tenantId: req.tenantId, outletId: req.outletId, outletIds: req.outletIds ?? [] });
    }),
  );
  probe.get(
    '/probe-admin',
    authenticate,
    authorize('settings:write'),
    asyncHandler(async (_req: Request, res: Response) => res.json({ ok: true })),
  );
  app.use('/api/test', probe);
  app.use(errorHandler);

  ctx = {
    app,
    tenantRepo,
    hubRepo,
    membershipRepo,
    accessRepo,
    userRepo,
    outletRepo,
    accessService,
    platformToken: '',
    memberToken: '',
  };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
  ctx.platformToken = platformToken();
  ctx.memberToken = memberToken();

  await seedTenant(ctx.tenantRepo, TENANT_A, 'Alpha Kopi', HUB);
  await seedTenant(ctx.tenantRepo, TENANT_B, 'Beta Resto', HUB);
  await seedTenant(ctx.tenantRepo, TENANT_C, 'Gamma Kafe', HUB_2);
  await seedOutlet(ctx.outletRepo, OUTLET_A1, TENANT_A, 'Outlet Alpha 1');
  await seedOutlet(ctx.outletRepo, OUTLET_A2, TENANT_A, 'Outlet Alpha 2');
  await seedOutlet(ctx.outletRepo, OUTLET_B1, TENANT_B, 'Outlet Beta 1');

  await ctx.hubRepo.save(makeHub({ id: HUB, name: 'Group One' }));
  await ctx.hubRepo.save(makeHub({ id: HUB_2, name: 'Group Two' }));

  await ctx.userRepo.save(
    User.hydrate({
      id: MEMBER,
      tenantId: TENANT_A,
      email: 'member@test.local',
      passwordHash: 'x',
      displayName: 'Member User',
      roleId: 'role-x',
      outletIds: [],
      isActive: true,
      lastLoginAt: null,
      pin: null,
      preferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
  await ctx.userRepo.save(
    User.hydrate({
      id: 'owner-a',
      tenantId: TENANT_A,
      email: 'owner@test.local',
      passwordHash: 'x',
      displayName: 'Owner Alpha',
      roleId: 'role-x',
      outletIds: [],
      isActive: true,
      lastLoginAt: null,
      pin: null,
      preferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );

  // Hub role `owner` — under pre-Fase 17 rules this alone granted every tenant.
  await ctx.membershipRepo.save(
    HubMembership.hydrate({
      id: `m-${MEMBER}`,
      hubId: HUB,
      userId: MEMBER,
      role: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
});

async function grant(tenantId: string, tenantRole: string, outletIds: string[] = []) {
  return ctx.accessService.setAccess({ hubId: HUB, userId: MEMBER, tenantId, tenantRole, outletIds });
}

describe('Hub V2 Fase 17 — access grants over HTTP', () => {
  // ------------------------------------------------- platform-admin surface

  describe('grant CRUD (platform admin)', () => {
    it('creates, reads, updates and revokes a grant', async () => {
      const create = await request(ctx.app)
        .put(`/api/hub-memberships/hub/${HUB}/${MEMBER}/access`)
        .set('Authorization', `Bearer ${ctx.platformToken}`)
        .set('X-Tenant-Id', 'platform')
        .send({ tenantId: TENANT_A, tenantRole: 'manager', outletIds: [OUTLET_A1] });
      expect(create.status).toBe(200);
      expect(create.body.data.tenantRole).toBe('manager');
      expect(create.body.data.outletIds).toEqual([OUTLET_A1]);

      const list = await request(ctx.app)
        .get(`/api/hub-memberships/hub/${HUB}/${MEMBER}/access`)
        .set('Authorization', `Bearer ${ctx.platformToken}`)
        .set('X-Tenant-Id', 'platform');
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);

      const update = await request(ctx.app)
        .put(`/api/hub-memberships/hub/${HUB}/${MEMBER}/access`)
        .set('Authorization', `Bearer ${ctx.platformToken}`)
        .set('X-Tenant-Id', 'platform')
        .send({ tenantId: TENANT_A, tenantRole: 'cashier', outletIds: [] });
      expect(update.status).toBe(200);
      expect(update.body.data.tenantRole).toBe('cashier');
      expect(update.body.data.outletIds).toEqual([]);

      // DELETE suspends (tombstone) — it must NOT hard-delete the row, otherwise
      // the member would silently fall back to broad hub-role access.
      const revoke = await request(ctx.app)
        .delete(`/api/hub-memberships/hub/${HUB}/${MEMBER}/access/${TENANT_A}`)
        .set('Authorization', `Bearer ${ctx.platformToken}`)
        .set('X-Tenant-Id', 'platform');
      expect(revoke.status).toBe(204);
      const rows = await ctx.accessRepo.findByHubAndUser(HUB, MEMBER);
      expect(rows).toHaveLength(1);
      expect(rows[0].serialize().status).toBe('suspended');
    });

    it('rejects an invalid tenant role with 400', async () => {
      const res = await request(ctx.app)
        .put(`/api/hub-memberships/hub/${HUB}/${MEMBER}/access`)
        .set('Authorization', `Bearer ${ctx.platformToken}`)
        .set('X-Tenant-Id', 'platform')
        .send({ tenantId: TENANT_A, tenantRole: 'superadmin' });
      expect(res.status).toBe(400);
    });

    it('rejects an outlet that belongs to another tenant with 400', async () => {
      const res = await request(ctx.app)
        .put(`/api/hub-memberships/hub/${HUB}/${MEMBER}/access`)
        .set('Authorization', `Bearer ${ctx.platformToken}`)
        .set('X-Tenant-Id', 'platform')
        .send({ tenantId: TENANT_A, tenantRole: 'manager', outletIds: [OUTLET_B1] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Outlet does not belong to this tenant/);
    });

    it('rejects a tenant from another hub with 400', async () => {
      const res = await request(ctx.app)
        .put(`/api/hub-memberships/hub/${HUB}/${MEMBER}/access`)
        .set('Authorization', `Bearer ${ctx.platformToken}`)
        .set('X-Tenant-Id', 'platform')
        .send({ tenantId: TENANT_C, tenantRole: 'viewer' });
      expect(res.status).toBe(400);
    });

    it('rejects a normal tenant token with 401 (platform namespace)', async () => {
      const tenantToken = jwt.sign(
        { sub: 'owner-a', tenant: TENANT_A, role: 'owner', roleName: 'Owner', permissions: [], outletIds: [] },
        TEST_SECRET,
        { expiresIn: '15m' },
      );
      const res = await request(ctx.app)
        .put(`/api/hub-memberships/hub/${HUB}/${MEMBER}/access`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .set('X-Tenant-Id', TENANT_A)
        .send({ tenantId: TENANT_A, tenantRole: 'viewer' });
      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------- DENY: switch-tenant

  describe('DENY — switch-tenant beyond the grant set', () => {
    it('403s a tenant that has no grant, even though the hub role is owner', async () => {
      await grant(TENANT_A, 'manager');

      const res = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .send({ tenantId: TENANT_B });
      expect(res.status).toBe(403);
    });

    it('403s a tenant that belongs to a different hub', async () => {
      await grant(TENANT_A, 'manager');

      const res = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .send({ tenantId: TENANT_C });
      expect(res.status).toBe(403);
    });

    it('403s a suspended grant', async () => {
      await grant(TENANT_A, 'manager');
      await ctx.accessService.updateAccess(HUB, MEMBER, TENANT_A, { status: 'suspended' });

      const res = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .send({ tenantId: TENANT_A });
      expect(res.status).toBe(403);
    });

    it('allows the granted tenant and embeds the granted role, not the hub role', async () => {
      await grant(TENANT_A, 'cashier', [OUTLET_A1]);

      const res = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .send({ tenantId: TENANT_A });
      expect(res.status).toBe(200);
      const claims = jwt.verify(res.body.data.accessToken, TEST_SECRET) as any;
      expect(claims.role).toBe('grant-cashier');
      expect(claims.roleName).toBe('Cashier');
      expect(claims.permissions).not.toContain(PERMISSIONS.SETTINGS_WRITE);
      expect(claims.outletIds).toEqual([OUTLET_A1]);
      // only the granted tenant is offered in the switcher
      expect(res.body.data.accessibleTenants.map((t: any) => t.tenantId)).toEqual([TENANT_A]);
    });

    it('hides a suspended tenant from the switcher but keeps the granted one', async () => {
      await grant(TENANT_A, 'viewer');
      await grant(TENANT_B, 'manager');
      await ctx.accessService.updateAccess(HUB, MEMBER, TENANT_B, { status: 'suspended' });

      const res = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .send({ tenantId: TENANT_A });
      expect(res.status).toBe(200);
      expect(res.body.data.accessibleTenants.map((t: any) => t.tenantId)).toEqual([TENANT_A]);
    });

    it('falls back to hub-role access when the member has no grants (ADR D3)', async () => {
      const res = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .send({ tenantId: TENANT_B });
      expect(res.status).toBe(200);
      const claims = jwt.verify(res.body.data.accessToken, TEST_SECRET) as any;
      expect(claims.role).toBe('hub-owner');
      expect(claims.outletIds).toEqual([]);
      expect(res.body.data.accessibleTenants.map((t: any) => t.tenantId).sort()).toEqual([TENANT_A, TENANT_B]);
    });

    it('grants are authoritative across hubs: no grant in hub 2 means no access', async () => {
      await ctx.membershipRepo.save(
        HubMembership.hydrate({
          id: `m2-${MEMBER}`,
          hubId: HUB_2,
          userId: MEMBER,
          role: 'owner',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any),
      );
      await grant(TENANT_A, 'manager');

      const res = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .send({ tenantId: TENANT_C });
      expect(res.status).toBe(403);
    });
  });

  // ------------------------------------------------- DENY: outlet narrowing

  describe('DENY — outlet scope', () => {
    it('403s an X-Outlet-Id outside the granted outlet list', async () => {
      await grant(TENANT_A, 'manager', [OUTLET_A1]);
      const switched = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .send({ tenantId: TENANT_A });
      const token = switched.body.data.accessToken;

      const denied = await request(ctx.app)
        .get('/api/test/probe')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-Outlet-Id', OUTLET_A2);
      expect(denied.status).toBe(403);
      expect(denied.body.error.message).toMatch(/tidak termasuk dalam akses user/);
    });

    it('accepts a granted outlet and a no-header request', async () => {
      await grant(TENANT_A, 'manager', [OUTLET_A1]);
      const token = (
        await request(ctx.app)
          .post('/api/auth/switch-tenant')
          .set('Authorization', `Bearer ${ctx.memberToken}`)
          .send({ tenantId: TENANT_A })
      ).body.data.accessToken;

      const ok = await request(ctx.app)
        .get('/api/test/probe')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-Outlet-Id', OUTLET_A1);
      expect(ok.status).toBe(200);
      expect(ok.body.outletId).toBe(OUTLET_A1);

      const noHeader = await request(ctx.app)
        .get('/api/test/probe')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', TENANT_A);
      expect(noHeader.status).toBe(200);
      expect(noHeader.body.outletId).toBeNull();
    });

    it('accepts any outlet when the grant is "all outlets" ([])', async () => {
      await grant(TENANT_A, 'manager', []);
      const token = (
        await request(ctx.app)
          .post('/api/auth/switch-tenant')
          .set('Authorization', `Bearer ${ctx.memberToken}`)
          .send({ tenantId: TENANT_A })
      ).body.data.accessToken;

      const res = await request(ctx.app)
        .get('/api/test/probe')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-Outlet-Id', OUTLET_A2);
      expect(res.status).toBe(200);
    });
  });

  // ------------------------------------------------- DENY: token permissions

  describe('DENY — granted role replaces hub-role permissions', () => {
    it('403s a settings:write route for a granted viewer', async () => {
      await grant(TENANT_A, 'viewer');
      const token = (
        await request(ctx.app)
          .post('/api/auth/switch-tenant')
          .set('Authorization', `Bearer ${ctx.memberToken}`)
          .send({ tenantId: TENANT_A })
      ).body.data.accessToken;

      const res = await request(ctx.app)
        .get('/api/test/probe-admin')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', TENANT_A);
      expect(res.status).toBe(403);
    });

    it('allows a settings:write route for a granted owner (narrowed to one outlet)', async () => {
      await grant(TENANT_A, 'owner', [OUTLET_A1]);
      const token = (
        await request(ctx.app)
          .post('/api/auth/switch-tenant')
          .set('Authorization', `Bearer ${ctx.memberToken}`)
          .send({ tenantId: TENANT_A })
      ).body.data.accessToken;

      const res = await request(ctx.app)
        .get('/api/test/probe-admin')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-Id', TENANT_A)
        .set('X-Outlet-Id', OUTLET_A1);
      expect(res.status).toBe(200);
    });
  });

  // ------------------------------------------------- /api/hub-context/me

  describe('GET /api/hub-context/me', () => {
    it('returns the signed-in member reach', async () => {
      await grant(TENANT_A, 'manager', [OUTLET_A1]);

      const res = await request(ctx.app)
        .get('/api/hub-context/me')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .set('X-Tenant-Id', TENANT_A);
      expect(res.status).toBe(200);
      expect(res.body.data.hubs[0].id).toBe(HUB);
      expect(res.body.data.grants).toHaveLength(1);
      expect(res.body.data.grants[0].tenantId).toBe(TENANT_A);
      expect(res.body.data.grants[0].allOutlets).toBe(false);
      expect(res.body.data.tenants.map((t: any) => t.tenantId)).toEqual([TENANT_A]);
      expect(res.body.data.effectivePermissions).toContain('orders:read');
    });

    it('401s without a token', async () => {
      const res = await request(ctx.app).get('/api/hub-context/me');
      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------- membership removal
  describe('removing a member revokes their reach', () => {
    it('suspends the grants and 403s switch-tenant afterwards', async () => {
      await grant(TENANT_A, 'manager');

      const res = await request(ctx.app)
        .delete(`/api/hub-memberships/${HUB}/${MEMBER}`)
        .set('Authorization', `Bearer ${ctx.platformToken}`)
        .set('X-Tenant-Id', 'platform');
      expect(res.status).toBe(204);

      // suspended, not deleted: the row must stay so the member cannot fall
      // back to broad hub-role access
      const rows = await ctx.accessRepo.findByHubAndUser(HUB, MEMBER);
      expect(rows).toHaveLength(1);
      expect(rows[0].serialize().status).toBe('suspended');

      const switchRes = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .send({ tenantId: TENANT_A });
      expect(switchRes.status).toBe(403);
    });

    it('drops the member from the switcher too', async () => {
      await grant(TENANT_A, 'manager');
      await request(ctx.app)
        .delete(`/api/hub-memberships/${HUB}/${MEMBER}`)
        .set('Authorization', `Bearer ${ctx.platformToken}`)
        .set('X-Tenant-Id', 'platform');

      const res = await request(ctx.app)
        .get('/api/hub-context/me')
        .set('Authorization', `Bearer ${ctx.memberToken}`)
        .set('X-Tenant-Id', TENANT_A);
      expect(res.body.data.tenants).toEqual([]);
    });
  });

  // ------------------------------------------------- ADR D3 baseline on add

  describe('adding a member seeds the D3 baseline', () => {
    it('gives a new member viewer reach to every tenant of the hub', async () => {
      const res = await request(ctx.app)
        .post('/api/hub-memberships')
        .set('Authorization', `Bearer ${ctx.platformToken}`)
        .set('X-Tenant-Id', 'platform')
        .send({ hubId: HUB, userId: 'owner-a', role: 'owner' });
      expect(res.status).toBe(201);

      const rows = await ctx.accessRepo.findByHubAndUser(HUB, 'owner-a');
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.serialize().tenantRole === 'viewer')).toBe(true);

      // hub role `owner` must NOT leak into the tenant sessions
      const switched = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set('Authorization', `Bearer ${ownerAToken()}`)
        .send({ tenantId: TENANT_B });
      expect(switched.status).toBe(200);
      const claims = jwt.verify(switched.body.data.accessToken, TEST_SECRET) as any;
      expect(claims.role).toBe('grant-viewer');
      expect(claims.permissions).not.toContain('settings:write');
    });
  });
});
