import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { makeHub } from '../fixtures/hub.fixtures';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { TEST_SECRET } from '../helpers/auth';

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { HubMembershipSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMembershipSchema';
import { HubMemberTenantAccessSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMemberTenantAccessSchema';
import { HubInvitationSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubInvitationSchema';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { SessionSchema } from '../../src/core/identity/infrastructure/persistence/schemas/SessionSchema';
import { OutletSchema } from '../../src/core/outlet/infrastructure/persistence/schemas/OutletSchema';

import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { MongoHubRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubRepository';
import { MongoHubMembershipRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMembershipRepository';
import { MongoHubMemberTenantAccessRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMemberTenantAccessRepository';
import { MongoHubInvitationRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubInvitationRepository';
import { MongoUserRepository } from '../../src/core/identity/infrastructure/persistence/MongoUserRepository';
import { MongoOutletRepository } from '../../src/core/outlet/infrastructure/persistence/MongoOutletRepository';

import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { User } from '../../src/core/identity/domain/User';
import { Outlet } from '../../src/core/outlet/domain/Outlet';

import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';
import { HubMemberAccessService } from '../../src/core/hub/application/services/HubMemberAccessService';
import { HubInvitationService } from '../../src/core/hub/application/services/HubInvitationService';
import { AuthService } from '../../src/core/identity/application/services/AuthService';
import { TokenService } from '../../src/core/identity/application/services/TokenService';
import { PasswordService } from '../../src/core/identity/domain/services/PasswordService';
import { SessionService } from '../../src/core/identity/application/services/SessionService';

import { HubMembershipController } from '../../src/core/hub/interfaces/http/controllers/HubMembershipController';
import { HubInvitationController } from '../../src/core/hub/interfaces/http/controllers/HubInvitationController';
import { HubController } from '../../src/core/hub/interfaces/http/controllers/HubController';
import { AuthController } from '../../src/core/identity/interfaces/http/controllers/AuthController';
import { createHubRoutes } from '../../src/core/hub/interfaces/http/routes/hub.routes';
import { createHubMembershipRoutes } from '../../src/core/hub/interfaces/http/routes/hubmembership.routes';
import { createHubContextRoutes } from '../../src/core/hub/interfaces/http/routes/hubcontext.routes';
import { createHubInvitationRoutes } from '../../src/core/hub/interfaces/http/routes/hubinvitation.routes';
import { createAuthRoutes } from '../../src/core/identity/interfaces/http/routes/auth.routes';
import { tenantContext } from '../../src/@shared/interfaces/middleware/tenantContext';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { PERMISSIONS } from '@posmono/shared';

const HUB = 'hub-1';
const HUB_2 = 'hub-2';
const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';
const OUTLET_A1 = 'outlet-a-1';
const INVITEE = 'invitee-user';
const PLATFORM_ADMIN = 'platform-admin';

let ctx: {
  app: Express;
  tenantRepo: InstanceType<typeof MongoTenantRepository>;
  hubRepo: InstanceType<typeof MongoHubRepository>;
  membershipRepo: InstanceType<typeof MongoHubMembershipRepository>;
  accessRepo: InstanceType<typeof MongoHubMemberTenantAccessRepository>;
  invitationRepo: InstanceType<typeof MongoHubInvitationRepository>;
  userRepo: InstanceType<typeof MongoUserRepository>;
  outletRepo: InstanceType<typeof MongoOutletRepository>;
  accessService: HubMemberAccessService;
  adminToken: string;
  readonlyToken: string;
  inviteeToken: string;
  otherToken: string;
};

function platformToken(permissions: string[]) {
  return jwt.sign(
    {
      sub: PLATFORM_ADMIN,
      tenant: 'platform',
      role: 'platform-super-admin',
      roleName: 'Platform Super Admin',
      permissions,
      outletIds: [],
    },
    TEST_SECRET,
    { expiresIn: '15m' },
  );
}

/** Ordinary tenant session — the audience of the accept endpoint. */
function userToken(userId: string) {
  return jwt.sign(
    { sub: userId, tenant: TENANT_A, role: 'user', roleName: 'Member', permissions: [], outletIds: [] },
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

function seedUser(
  repo: InstanceType<typeof MongoUserRepository>,
  id: string,
  email: string,
  tenantId = TENANT_A,
) {
  return repo.save(
    User.hydrate({
      id,
      tenantId,
      email,
      passwordHash: 'x',
      displayName: id,
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

  const tenantRepo = new MongoTenantRepository(mongoose.model('Tenant', TenantSchema));
  const hubRepo = new MongoHubRepository(mongoose.model('Hub', HubSchema));
  const membershipRepo = new MongoHubMembershipRepository(
    mongoose.model('HubMembership', HubMembershipSchema),
  );
  const accessRepo = new MongoHubMemberTenantAccessRepository(
    mongoose.model('HubMemberTenantAccess', HubMemberTenantAccessSchema),
  );
  const invitationRepo = new MongoHubInvitationRepository(
    mongoose.model('HubInvitation', HubInvitationSchema),
  );
  const userRepo = new MongoUserRepository(mongoose.model('User', UserSchema));
  const outletRepo = new MongoOutletRepository(mongoose.model('Outlet', OutletSchema));

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

  const invitationService = new HubInvitationService({
    invitationRepository: invitationRepo,
    hubRepository: hubRepo,
    membershipService: hubMembershipService,
    userRepository: userRepo,
  });

  const authService = new AuthService(
    userRepo,
    new TokenService(),
    new PasswordService(),
    new SessionService(mongoose.model('Session', SessionSchema)),
    undefined,
    hubMembershipService,
    accessService,
  );

  const membershipController = new HubMembershipController(
    hubMembershipService,
    undefined,
    accessService,
  );
  const invitationController = new HubInvitationController(invitationService);

  const app = express();
  app.use(express.json());
  app.use(tenantContext);
  app.use('/api/auth', createAuthRoutes(new AuthController(authService)));
  // The real factory, so the invitation routes inherit the production guard
  // chain. Only the invitation half is exercised here; the hub half gets a stub
  // because `createHubRoutes` binds its methods eagerly.
  const stubHubController = {
    list: async () => {},
    getById: async () => {},
    create: async () => {},
    update: async () => {},
    delete: async () => {},
    assignTenant: async () => {},
    unassignTenant: async () => {},
    listTenants: async () => {},
  } as unknown as HubController;
  app.use('/api/hubs', createHubRoutes(stubHubController, invitationController));
  app.use('/api/hub-memberships', createHubMembershipRoutes(membershipController));
  app.use('/api/hub-context', createHubContextRoutes(membershipController));
  app.use('/api/hub-invitations', createHubInvitationRoutes(invitationController));
  app.use(errorHandler);

  // The partial unique index is part of what "one open invitation per address"
  // means, so build it here the way boot does.
  await mongoose.model('HubInvitation', HubInvitationSchema).syncIndexes();
  await mongoose.model('HubMembership', HubMembershipSchema).syncIndexes();

  ctx = {
    app,
    tenantRepo,
    hubRepo,
    membershipRepo,
    accessRepo,
    invitationRepo,
    userRepo,
    outletRepo,
    accessService,
    adminToken: '',
    readonlyToken: '',
    inviteeToken: '',
    otherToken: '',
  };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
  ctx.adminToken = platformToken([PERMISSIONS.PLATFORM_HUBS_MANAGE]);
  ctx.readonlyToken = platformToken([PERMISSIONS.PLATFORM_TENANTS_READ]);
  ctx.inviteeToken = userToken(INVITEE);
  ctx.otherToken = userToken('other-user');

  await seedTenant(ctx.tenantRepo, TENANT_A, 'Alpha Kopi', HUB);
  await seedTenant(ctx.tenantRepo, TENANT_B, 'Beta Resto', HUB);
  await seedOutlet(ctx.outletRepo, OUTLET_A1, TENANT_A, 'Outlet Alpha 1');
  await ctx.hubRepo.save(makeHub({ id: HUB, name: 'Group One' }));
  await ctx.hubRepo.save(makeHub({ id: HUB_2, name: 'Group Two' }));

  await seedUser(ctx.userRepo, INVITEE, 'budi@kopi.id');
  await seedUser(ctx.userRepo, 'other-user', 'mallory@kopi.id');
  // An existing member with hub role `owner` and no grants: the ADR D3 baseline
  // that a suspension must be able to cut off.
  await seedUser(ctx.userRepo, 'owner-a', 'owner@kopi.id');
  await ctx.membershipRepo.save(
    HubMembership.hydrate({
      id: 'm-owner-a',
      hubId: HUB,
      userId: 'owner-a',
      role: 'owner',
      status: 'active',
      suspendedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
});

function admin() {
  return { Authorization: `Bearer ${ctx.adminToken}` };
}

function invitee() {
  return { Authorization: `Bearer ${ctx.inviteeToken}` };
}

function invite(email: string, role = 'viewer', hubId = HUB) {
  return request(ctx.app)
    .post(`/api/hubs/${hubId}/invitations`)
    .set(admin())
    .send({ email, role });
}

describe('Hub V2 Fase 20 — invitations over HTTP', () => {
  // ------------------------------------------------------- platform surface

  describe('issue an invitation (platform admin)', () => {
    it('creates it and returns the raw token once, without the digest', async () => {
      const res = await invite('budi@kopi.id', 'manager');

      expect(res.status).toBe(201);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.invitation.email).toBe('budi@kopi.id');
      expect(res.body.data.invitation.roleLabel).toMatch(/Manager/i);
      expect(res.body.data.invitation.tokenHash).toBeUndefined();

      // The stored row is a digest, so a database dump cannot be replayed.
      const stored = await ctx.invitationRepo.findPendingByHubAndEmail(HUB, 'budi@kopi.id');
      expect(stored).not.toBeNull();
      expect(stored!.serialize().tokenHash).not.toBe(res.body.data.token);
    });

    it('lists the hub invitations and revokes a pending one', async () => {
      const created = await invite('budi@kopi.id');
      const id = created.body.data.invitation.id;

      const list = await request(ctx.app).get(`/api/hubs/${HUB}/invitations`).set(admin());
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].email).toBe('budi@kopi.id');

      const revoked = await request(ctx.app)
        .delete(`/api/hubs/${HUB}/invitations/${id}`)
        .set(admin());
      expect(revoked.status).toBe(200);
      expect(revoked.body.data.status).toBe('revoked');
    });

    it('409s a second open invitation for the same address', async () => {
      await invite('budi@kopi.id');
      const again = await invite('BUDI@kopi.id');
      expect(again.status).toBe(409);
    });

    it('409s inviting somebody who is already a member', async () => {
      const res = await invite('owner@kopi.id');
      expect(res.status).toBe(409);
    });

    it('400s a malformed address and an unknown role', async () => {
      expect((await invite('budi-at-kopi')).status).toBe(400);
      expect((await invite('budi@kopi.id', 'superuser')).status).toBe(400);
    });

    it('refuses to invite into an archived hub', async () => {
      await ctx.hubRepo.save(makeHub({ id: HUB_2, name: 'Group Two', status: 'archived' }));
      const res = await request(ctx.app)
        .post(`/api/hubs/${HUB_2}/invitations`)
        .set(admin())
        .send({ email: 'budi@kopi.id', role: 'viewer' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/archived/);
    });

    it('RBAC — DENIES a platform token without platform.hubs.manage', async () => {
      const res = await request(ctx.app)
        .post(`/api/hubs/${HUB}/invitations`)
        .set({ Authorization: `Bearer ${ctx.readonlyToken}` })
        .send({ email: 'budi@kopi.id', role: 'viewer' });
      expect(res.status).toBe(403);
    });

    it('DENIES a platform route to an ordinary tenant token', async () => {
      const res = await request(ctx.app)
        .post(`/api/hubs/${HUB}/invitations`)
        .set(invitee())
        .send({ email: 'budi@kopi.id', role: 'viewer' });
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------- invitee surface

  describe('preview and accept (invitee)', () => {
    it('previews then accepts, creating the membership and its grant baseline', async () => {
      const created = await invite('budi@kopi.id', 'manager');
      const token = created.body.data.token;

      const preview = await request(ctx.app).get(`/api/hub-invitations/${token}`).set(invitee());
      expect(preview.status).toBe(200);
      expect(preview.body.data).toMatchObject({
        hubId: HUB,
        hubName: 'Group One',
        email: 'budi@kopi.id',
        emailMatches: true,
        alreadyMember: false,
      });

      const accepted = await request(ctx.app).post(`/api/hub-invitations/${token}/accept`).set(invitee());
      expect(accepted.status).toBe(200);
      expect(accepted.body.data.created).toBe(true);
      expect(accepted.body.data.membership.role).toBe('manager');

      const membership = await ctx.membershipRepo.findByHubAndUser(HUB, INVITEE);
      expect(membership).not.toBeNull();
      expect(membership!.serialize().status).toBe('active');

      // ADR D3: accepting an invitation seeds the viewer baseline, so the new
      // member never inherits the permissive zero-grant fallback.
      const grants = await ctx.accessService.listGrantsForMember(HUB, INVITEE);
      expect(grants.map((g) => g.tenantId).sort()).toEqual([TENANT_A, TENANT_B].sort());
      expect(grants.every((g) => g.tenantRole === 'viewer')).toBe(true);
    });

    it('lets the new member reach the hub tenants through switch-tenant', async () => {
      const created = await invite('budi@kopi.id', 'viewer');

      await request(ctx.app)
        .post(`/api/hub-invitations/${created.body.data.token}/accept`)
        .set(invitee());

      const res = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set(invitee())
        .send({ tenantId: TENANT_B });
      expect(res.status).toBe(200);
      expect(res.body.data.accessibleTenants.map((t: any) => t.tenantId).sort()).toEqual(
        [TENANT_A, TENANT_B].sort(),
      );
    });

    it('DENIES a link opened by a different account and leaves the invite spendable', async () => {
      const created = await invite('budi@kopi.id');
      const token = created.body.data.token;

      const res = await request(ctx.app)
        .post(`/api/hub-invitations/${token}/accept`)
        .set({ Authorization: `Bearer ${ctx.otherToken}` });
      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/mallory@kopi.id/);

      // The rightful owner can still redeem it.
      const owner = await request(ctx.app).post(`/api/hub-invitations/${token}/accept`).set(invitee());
      expect(owner.status).toBe(200);
    });

    it('DENIES a revoked invitation', async () => {
      const created = await invite('budi@kopi.id');
      const token = created.body.data.token;
      await request(ctx.app)
        .delete(`/api/hubs/${HUB}/invitations/${created.body.data.invitation.id}`)
        .set(admin());

      const res = await request(ctx.app).post(`/api/hub-invitations/${token}/accept`).set(invitee());
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/dicabut/i);
    });

    it('DENIES reusing an accepted invitation', async () => {
      const created = await invite('budi@kopi.id');
      const token = created.body.data.token;
      await request(ctx.app).post(`/api/hub-invitations/${token}/accept`).set(invitee());

      const res = await request(ctx.app).post(`/api/hub-invitations/${token}/accept`).set(invitee());
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/sudah pernah diterima/i);
    });

    it('DENIES an unknown token', async () => {
      const res = await request(ctx.app).post('/api/hub-invitations/tidak-ada/accept').set(invitee());
      expect(res.status).toBe(404);
    });

    it('DENIES an unauthenticated caller', async () => {
      const created = await invite('budi@kopi.id');
      const res = await request(ctx.app).post(
        `/api/hub-invitations/${created.body.data.token}/accept`,
      );
      expect(res.status).toBe(401);
    });

    it('is idempotent when the admin already added the member by hand', async () => {
      const created = await invite('budi@kopi.id', 'manager');
      await ctx.membershipRepo.save(
        HubMembership.hydrate({
          id: 'm-invitee',
          hubId: HUB,
          userId: INVITEE,
          role: 'admin',
          status: 'active',
          suspendedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any),
      );

      const res = await request(ctx.app)
        .post(`/api/hub-invitations/${created.body.data.token}/accept`)
        .set(invitee());
      expect(res.status).toBe(200);
      expect(res.body.data.created).toBe(false);
      expect(res.body.data.membership.role).toBe('admin');
    });
  });

  // ------------------------------------------------------- member suspension

  describe('suspending a member', () => {
    const ownerToken = () => ({ Authorization: `Bearer ${userToken('owner-a')}` });

    it('suspends, denies access everywhere, and reactivates back to the previous reach', async () => {
      // Baseline: no grants at all, so the member is on the ADR D3 fallback.
      const before = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set(ownerToken())
        .send({ tenantId: TENANT_B });
      expect(before.status).toBe(200);

      const suspended = await request(ctx.app)
        .put(`/api/hub-memberships/${HUB}/owner-a/status`)
        .set(admin())
        .send({ status: 'suspended' });
      expect(suspended.status).toBe(200);
      expect(suspended.body.data.status).toBe('suspended');
      expect(suspended.body.data.suspendedAt).toBeTruthy();

      // DENY: the token issued before the suspension is already useless, because
      // the check happens at resolution time.
      const denied = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set(ownerToken())
        .send({ tenantId: TENANT_B });
      expect(denied.status).toBe(403);
      expect(denied.body.data?.accessibleTenants ?? []).toEqual([]);

      // The hub drops out of the member's context too.
      const context = await request(ctx.app).get('/api/hub-context/me').set(ownerToken());
      expect(context.status).toBe(200);
      expect(context.body.data.hubs).toEqual([]);
      expect(context.body.data.tenants).toEqual([]);

      const reactivated = await request(ctx.app)
        .put(`/api/hub-memberships/${HUB}/owner-a/status`)
        .set(admin())
        .send({ status: 'active' });
      expect(reactivated.status).toBe(200);
      expect(reactivated.body.data.status).toBe('active');
      expect(reactivated.body.data.suspendedAt).toBeNull();

      const after = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set(ownerToken())
        .send({ tenantId: TENANT_B });
      expect(after.status).toBe(200);
    });

    it('DENYs a suspended member even when they still hold active per-tenant grants', async () => {
      await ctx.accessService.setAccess({
        hubId: HUB,
        userId: 'owner-a',
        tenantId: TENANT_A,
        tenantRole: 'manager',
      });

      await request(ctx.app)
        .put(`/api/hub-memberships/${HUB}/owner-a/status`)
        .set(admin())
        .send({ status: 'suspended' });

      // The grant row is deliberately left active: the membership is the gate.
      const grants = await ctx.accessService.listGrantsForMember(HUB, 'owner-a');
      expect(grants[0].status).toBe('active');

      const denied = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set(ownerToken())
        .send({ tenantId: TENANT_A });
      expect(denied.status).toBe(403);

      const preview = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set(ownerToken())
        .send({ tenantId: TENANT_B });
      expect(preview.status).toBe(403);
    });

    it('keeps a suspended member out of the member list of reachable tenants, and shows the status', async () => {
      const list = await request(ctx.app).get(`/api/hub-memberships/hub/${HUB}`).set(admin());
      expect(list.status).toBe(200);
      expect(list.body.data[0]).toMatchObject({ userId: 'owner-a', status: 'active' });

      await request(ctx.app)
        .put(`/api/hub-memberships/${HUB}/owner-a/status`)
        .set(admin())
        .send({ status: 'suspended' });

      const after = await request(ctx.app).get(`/api/hub-memberships/hub/${HUB}`).set(admin());
      expect(after.body.data[0]).toMatchObject({ userId: 'owner-a', status: 'suspended' });
    });

    it('400s a repeated suspend, a missing status and an unknown status', async () => {
      const repeated = await request(ctx.app)
        .put(`/api/hub-memberships/${HUB}/owner-a/status`)
        .set(admin())
        .send({ status: 'suspended' });
      expect(repeated.status).toBe(200);
      const again = await request(ctx.app)
        .put(`/api/hub-memberships/${HUB}/owner-a/status`)
        .set(admin())
        .send({ status: 'suspended' });
      expect(again.status).toBe(400);

      expect(
        (await request(ctx.app)
          .put(`/api/hub-memberships/${HUB}/owner-a/status`)
          .set(admin())
          .send({})).status,
      ).toBe(400);
      expect(
        (await request(ctx.app)
          .put(`/api/hub-memberships/${HUB}/owner-a/status`)
          .set(admin())
          .send({ status: 'archived' })).status,
      ).toBe(400);
    });

    it('re-adding a suspended member reactivates it instead of reporting a duplicate', async () => {
      await request(ctx.app)
        .put(`/api/hub-memberships/${HUB}/owner-a/status`)
        .set(admin())
        .send({ status: 'suspended' });

      const added = await request(ctx.app)
        .post('/api/hub-memberships')
        .set(admin())
        .send({ hubId: HUB, userId: 'owner-a', role: 'manager' });
      expect(added.status).toBe(201);
      expect(added.body.data.status).toBe('active');
      expect(added.body.data.role).toBe('manager');

      const res = await request(ctx.app)
        .post('/api/auth/switch-tenant')
        .set(ownerToken())
        .send({ tenantId: TENANT_B });
      expect(res.status).toBe(200);
    });

    it('still 409s adding a member who is already active', async () => {
      const res = await request(ctx.app)
        .post('/api/hub-memberships')
        .set(admin())
        .send({ hubId: HUB, userId: 'owner-a', role: 'manager' });
      expect(res.status).toBe(409);
    });

    it('RBAC — DENIES suspending a member without platform.hubs.manage', async () => {
      const res = await request(ctx.app)
        .put(`/api/hub-memberships/${HUB}/owner-a/status`)
        .set({ Authorization: `Bearer ${ctx.readonlyToken}` })
        .send({ status: 'suspended' });
      expect(res.status).toBe(403);
    });
  });
});
