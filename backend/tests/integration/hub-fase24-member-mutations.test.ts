import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import request from 'supertest';
import express, { Express } from 'express';
import { makeHub } from '../fixtures/hub.fixtures';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { generateTestToken } from '../helpers/auth';

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { HubMembershipSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMembershipSchema';
import { HubMemberTenantAccessSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMemberTenantAccessSchema';
import { HubInvitationSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubInvitationSchema';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { OutletSchema } from '../../src/core/outlet/infrastructure/persistence/schemas/OutletSchema';
import { PlatformAuditLogSchema } from '../../src/core/platform/audit/infrastructure/persistence/schemas/PlatformAuditLogSchema';

import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { MongoHubRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubRepository';
import { MongoHubMembershipRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMembershipRepository';
import { MongoHubMemberTenantAccessRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMemberTenantAccessRepository';
import { MongoHubInvitationRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubInvitationRepository';
import { MongoUserRepository } from '../../src/core/identity/infrastructure/persistence/MongoUserRepository';
import { MongoOutletRepository } from '../../src/core/outlet/infrastructure/persistence/MongoOutletRepository';
import { MongoPlatformAuditLogRepository } from '../../src/core/platform/audit/infrastructure/persistence/MongoPlatformAuditLogRepository';

import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { User } from '../../src/core/identity/domain/User';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';

import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';
import { HubMemberAccessService } from '../../src/core/hub/application/services/HubMemberAccessService';
import { HubInvitationService } from '../../src/core/hub/application/services/HubInvitationService';
import { PlatformAuditService } from '../../src/core/platform/audit/application/services/PlatformAuditService';

import { MyHubAdminController } from '../../src/core/hub/interfaces/http/controllers/MyHubAdminController';
import { createMyHubAdminRoutes } from '../../src/core/hub/interfaces/http/routes/myhubadmin.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';

const HUB = 'hub-1';
const HUB_ARCHIVED = 'hub-archived';
const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';
const TENANT_OUTSIDE = 'tenant-luar-hub';

const OWNER = 'user-owner';
const ADMIN = 'user-admin';
const ADMIN_2 = 'user-admin-2';
const MANAGER = 'user-manager';
const VIEWER = 'user-viewer';
const CASHIER = 'user-cashier';
const OUTSIDER = 'user-outsider';
const OUTSIDE_USER = 'user-tenant-luar';

let ctx: {
  app: Express;
  tenantRepo: MongoTenantRepository;
  hubRepo: MongoHubRepository;
  membershipRepo: MongoHubMembershipRepository;
  accessRepo: MongoHubMemberTenantAccessRepository;
  invitationRepo: MongoHubInvitationRepository;
  userRepo: MongoUserRepository;
  auditModel: Model<any>;
  auditService: PlatformAuditService;
};

/**
 * Permission-less tokens on purpose, as in the Fase 21 suite: if any of these
 * assertions could be satisfied by the JWT, the `hub.*` membership guard would be
 * decorative rather than the thing under test.
 */
function memberToken(userId: string, tenantId = TENANT_A): string {
  return generateTestToken({ sub: userId, tenant: tenantId, permissions: [] });
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
      config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
      billingEmail: `${slug}@test.local`,
      hubId: hubId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
}

function seedUser(id: string, name: string, email: string, tenantId = TENANT_A, isActive = true) {
  return ctx.userRepo.save(
    User.hydrate({
      id,
      tenantId,
      email,
      passwordHash: 'hash',
      displayName: name,
      roleId: `role-${tenantId}`,
      outletIds: [],
      isActive,
      lastLoginAt: null,
      pin: null,
      preferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
}

async function seedMembership(userId: string, hubId: string, role: string, status?: 'active' | 'suspended') {
  const membership = HubMembership.create({ hubId, userId, role: role as any });
  if (status === 'suspended') membership.suspend();
  return ctx.membershipRepo.save(membership);
}

/** Suspend an existing row instead of inserting a second one for the same pair. */
async function suspendMembership(userId: string, hubId: string) {
  const membership = await ctx.membershipRepo.findByHubAndUser(hubId, userId);
  expect(membership).not.toBeNull();
  membership!.suspend();
  return ctx.membershipRepo.save(membership!);
}

beforeAll(async () => {
  await setupTestDb();
  const c = mongoose.connection;

  const tenantRepo = new MongoTenantRepository(c.model('Tenant', TenantSchema));
  const hubRepo = new MongoHubRepository(c.model('Hub', HubSchema));
  const membershipRepo = new MongoHubMembershipRepository(
    c.model('HubMembership', HubMembershipSchema),
  );
  const accessRepo = new MongoHubMemberTenantAccessRepository(
    c.model('HubMemberTenantAccess', HubMemberTenantAccessSchema),
  );
  const invitationRepo = new MongoHubInvitationRepository(
    c.model('HubInvitation', HubInvitationSchema),
  );
  const userRepo = new MongoUserRepository(c.model('User', UserSchema));
  const outletRepo = new MongoOutletRepository(c.model('Outlet', OutletSchema));
  const auditModel = c.model('PlatformAuditLog', PlatformAuditLogSchema);
  const auditService = new PlatformAuditService(
    new MongoPlatformAuditLogRepository(auditModel),
  );

  const accessService = new HubMemberAccessService({
    accessRepository: accessRepo,
    hubMembershipRepository: membershipRepo,
    hubRepository: hubRepo,
    tenantRepository: tenantRepo,
    outletRepository: outletRepo,
  });

  const membershipService = new HubMembershipService({
    hubMembershipRepository: membershipRepo,
    hubRepository: hubRepo,
    tenantRepository: tenantRepo,
    userRepository: userRepo,
  });

  const invitationService = new HubInvitationService({
    invitationRepository: invitationRepo,
    hubRepository: hubRepo,
    membershipService,
    userRepository: userRepo,
  });

  const controller = new MyHubAdminController({
    membershipService,
    invitationService,
    accessService,
    userRepository: userRepo,
    tenantRepository: tenantRepo,
    auditService,
  });

  const app = express();
  app.use(express.json());
  // The real route factory, so `authenticate` + `requireHubPermission` run in the
  // order production mounts them.
  app.use('/api/hub', createMyHubAdminRoutes(controller, accessService));
  app.use(errorHandler);

  ctx = {
    app,
    tenantRepo,
    hubRepo,
    membershipRepo,
    accessRepo,
    invitationRepo,
    userRepo,
    auditModel,
    auditService,
  };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();

  await ctx.hubRepo.save(makeHub({ id: HUB, name: 'BCA Hospitality', code: 'BCA' }));
  await ctx.hubRepo.save(makeHub({ id: HUB_ARCHIVED, name: 'Archived Group', code: 'ARCH', status: 'archived' }));

  await seedTenant(TENANT_A, 'Alpha Kopi', 'alpha-kopi', HUB);
  await seedTenant(TENANT_B, 'Beta Resto', 'beta-resto', HUB);
  await seedTenant(TENANT_OUTSIDE, 'Gamma Cafe', 'gamma-cafe', null);

  await seedUser(OWNER, 'Owner', `${OWNER}@test.local`);
  await seedUser(ADMIN, 'Admin', `${ADMIN}@test.local`);
  await seedUser(ADMIN_2, 'Admin Dua', `${ADMIN_2}@test.local`);
  await seedUser(MANAGER, 'Manager', `${MANAGER}@test.local`);
  await seedUser(VIEWER, 'Viewer', `${VIEWER}@test.local`);
  await seedUser(CASHIER, 'Kasir', `${CASHIER}@test.local`, TENANT_B);
  await seedUser(OUTSIDER, 'Outsider', `${OUTSIDER}@test.local`);
  await seedUser(OUTSIDE_USER, 'Gamma Karyawan', `${OUTSIDE_USER}@test.local`, TENANT_OUTSIDE);

  await seedMembership(OWNER, HUB, 'owner');
  await seedMembership(ADMIN, HUB, 'admin');
  await seedMembership(ADMIN_2, HUB, 'admin');
  await seedMembership(MANAGER, HUB, 'manager');
  await seedMembership(VIEWER, HUB, 'viewer');
  await seedMembership(OWNER, HUB_ARCHIVED, 'owner');
});

const asUser = (userId: string) => `Bearer ${memberToken(userId)}`;

describe('Hub member mutations (/api/hub/*) — Fase 24', () => {
  describe('DENY — authentication, membership and permission', () => {
    it('401 without a token', async () => {
      await request(ctx.app).post(`/api/hub/${HUB}/members`).send({ userId: CASHIER, role: 'viewer' }).expect(401);
      await request(ctx.app).get(`/api/hub/${HUB}/members/candidates`).expect(401);
      await request(ctx.app).delete(`/api/hub/${HUB}/members/${MANAGER}`).expect(401);
    });

    it('403 for a signed-in non-member', async () => {
      await request(ctx.app)
        .post(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(OUTSIDER))
        .send({ userId: CASHIER, role: 'viewer' })
        .expect(403);
      await request(ctx.app)
        .get(`/api/hub/${HUB}/members/candidates`)
        .set('Authorization', asUser(OUTSIDER))
        .expect(403);
    });

    it('403 for a hub without `hub.members.manage` (manager and viewer)', async () => {
      await request(ctx.app)
        .post(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(MANAGER))
        .send({ userId: CASHIER, role: 'viewer' })
        .expect(403);
      await request(ctx.app)
        .delete(`/api/hub/${HUB}/members/${VIEWER}`)
        .set('Authorization', asUser(MANAGER))
        .expect(403);
      await request(ctx.app)
        .post(`/api/hub/${HUB}/invitations`)
        .set('Authorization', asUser(MANAGER))
        .send({ email: 'baru@test.local', role: 'viewer' })
        .expect(403);
    });

    it('403 for a viewer on reads it has no `hub.members.read` for', async () => {
      await request(ctx.app)
        .get(`/api/hub/${HUB}/members/candidates`)
        .set('Authorization', asUser(VIEWER))
        .expect(403);
      await request(ctx.app)
        .get(`/api/hub/${HUB}/invitations`)
        .set('Authorization', asUser(VIEWER))
        .expect(403);
    });

    it('`hub.members.read` still allows reads without `hub.members.manage`', async () => {
      await request(ctx.app)
        .get(`/api/hub/${HUB}/members/candidates`)
        .set('Authorization', asUser(MANAGER))
        .expect(200);
      await request(ctx.app)
        .get(`/api/hub/${HUB}/invitations`)
        .set('Authorization', asUser(MANAGER))
        .expect(200);
    });

    it('403 for a suspended member', async () => {
      await suspendMembership(VIEWER, HUB);
      await request(ctx.app)
        .post(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(VIEWER))
        .send({ userId: CASHIER, role: 'viewer' })
        .expect(403);
    });

    it('403 on an archived hub', async () => {
      await request(ctx.app)
        .post(`/api/hub/${HUB_ARCHIVED}/members`)
        .set('Authorization', asUser(OWNER))
        .send({ userId: CASHIER, role: 'viewer' })
        .expect(403);
    });
  });

  describe('DENY — the ceiling a permission cannot express', () => {
    it('an admin cannot promote anybody to owner', async () => {
      const res = await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${MANAGER}`)
        .set('Authorization', asUser(ADMIN))
        .send({ role: 'owner' })
        .expect(400);
      expect(res.body.error.message).toMatch(/tidak bisa memberikan role owner/);
      const membership = await ctx.membershipRepo.findByHubAndUser(HUB, MANAGER);
      expect(membership?.serialize().role).toBe('manager');
    });

    it('an admin cannot add a member at owner level', async () => {
      const res = await request(ctx.app)
        .post(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(ADMIN))
        .send({ userId: CASHIER, role: 'owner' })
        .expect(400);
      expect(res.body.error.message).toMatch(/tidak bisa memberikan role owner/);
    });

    it('an admin cannot touch a peer admin either — only strictly lower ranks', async () => {
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${ADMIN_2}`)
        .set('Authorization', asUser(ADMIN))
        .send({ role: 'manager' })
        .expect(400);
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${ADMIN_2}/status`)
        .set('Authorization', asUser(ADMIN))
        .send({ status: 'suspended' })
        .expect(400);
      await request(ctx.app)
        .delete(`/api/hub/${HUB}/members/${ADMIN_2}`)
        .set('Authorization', asUser(ADMIN))
        .expect(400);
    });

    it('an admin cannot touch an owner either', async () => {
      await request(ctx.app)
        .delete(`/api/hub/${HUB}/members/${OWNER}`)
        .set('Authorization', asUser(ADMIN))
        .expect(400);
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${OWNER}/status`)
        .set('Authorization', asUser(ADMIN))
        .send({ status: 'suspended' })
        .expect(400);
    });

    it('nobody edits their own row', async () => {
      const selfEdits = [
        request(ctx.app).put(`/api/hub/${HUB}/members/${ADMIN}`).set('Authorization', asUser(ADMIN)).send({ role: 'manager' }),
        request(ctx.app).put(`/api/hub/${HUB}/members/${ADMIN}/status`).set('Authorization', asUser(ADMIN)).send({ status: 'suspended' }),
        request(ctx.app).delete(`/api/hub/${HUB}/members/${ADMIN}`).set('Authorization', asUser(ADMIN)),
      ];
      for (const pending of selfEdits) {
        const res = await pending.expect(400);
        expect(res.body.error.message).toMatch(/akun Anda sendiri/);
      }
      // An owner is still an owner afterwards.
      const membership = await ctx.membershipRepo.findByHubAndUser(HUB, ADMIN);
      expect(membership?.serialize().role).toBe('admin');
    });

    it('an owner row is immutable from this surface, so the hub stays administrable', async () => {
      // Nothing ranks above `owner`: the only way to reach one is from a third
      // party, and there is no third party. Handing the hub over is platform-side.
      const owner2 = 'user-owner-2';
      await seedUser(owner2, 'Owner Dua', `${owner2}@test.local`);
      await seedMembership(owner2, HUB, 'owner');
      expect(await ctx.membershipRepo.countByHub(HUB)).toBeGreaterThan(1);

      // A peer owner is refused by the rank rule (not by a separate orphan guard).
      const peer = await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${OWNER}`)
        .set('Authorization', asUser(owner2))
        .send({ role: 'admin' })
        .expect(400);
      expect(peer.body.error.message).toMatch(/owner atau lebih tinggi/);

      // And the last owner cannot even touch themselves.
      const self = await request(ctx.app)
        .delete(`/api/hub/${HUB}/members/${OWNER}`)
        .set('Authorization', asUser(OWNER))
        .expect(400);
      expect(self.body.error.message).toMatch(/akun Anda sendiri/);

      const membership = await ctx.membershipRepo.findByHubAndUser(HUB, OWNER);
      expect(membership?.serialize().role).toBe('owner');
    });
  });

  describe('DENY — who may be added', () => {
    it('a user outside the hub\'s tenants cannot be added directly', async () => {
      const res = await request(ctx.app)
        .post(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(OWNER))
        .send({ userId: OUTSIDE_USER, role: 'viewer' })
        .expect(400);
      expect(res.body.error.message).toMatch(/bukan bagian dari tenant di hub ini/);
      expect(await ctx.membershipRepo.findByHubAndUser(HUB, OUTSIDE_USER)).toBeNull();
    });

    it('the candidate search never leaves the hub\'s tenants', async () => {
      const res = await request(ctx.app)
        .get(`/api/hub/${HUB}/members/candidates?search=Gamma`)
        .set('Authorization', asUser(OWNER))
        .expect(200);
      expect(res.body.data.items).toHaveLength(0);

      const own = await request(ctx.app)
        .get(`/api/hub/${HUB}/members/candidates?search=Karyawan`)
        .set('Authorization', asUser(OWNER))
        .expect(200);
      expect(own.body.data.items.map((i: any) => i.id)).not.toContain(OUTSIDE_USER);
    });

    it('a hub with no tenants has no candidates at all', async () => {
      await ctx.hubRepo.save(makeHub({ id: 'hub-kosong', name: 'Hub Kosong', code: 'KOSONG' }));
      await seedMembership(OWNER, 'hub-kosong', 'owner');
      const res = await request(ctx.app)
        .get('/api/hub/hub-kosong/members/candidates')
        .set('Authorization', asUser(OWNER))
        .expect(200);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('404 for a user that does not exist', async () => {
      await request(ctx.app)
        .post(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(OWNER))
        .send({ userId: 'user-tidak-ada', role: 'viewer' })
        .expect(404);
    });

    it('400 for a missing or invalid role', async () => {
      await request(ctx.app)
        .post(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(OWNER))
        .send({ userId: CASHIER })
        .expect(400);
      await request(ctx.app)
        .post(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(OWNER))
        .send({ userId: CASHIER, role: 'superuser' })
        .expect(400);
    });
  });

  describe('DENY — access grant ceiling', () => {
    it('an admin cannot grant a tenant role above admin', async () => {
      // `manager` never reaches this route at all — the matrix does not give it
      // `hub.members.manage` — so the cap is observable from `admin` upwards.
      await seedMembership(CASHIER, HUB, 'viewer');
      const res = await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${CASHIER}/access`)
        .set('Authorization', asUser(ADMIN))
        .send({ tenantId: TENANT_A, tenantRole: 'owner' })
        .expect(400);
      expect(res.body.error.message).toMatch(/sampai role admin/);
    });

    it('an owner may grant tenant owner', async () => {
      await seedMembership(CASHIER, HUB, 'viewer');
      const res = await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${CASHIER}/access`)
        .set('Authorization', asUser(OWNER))
        .send({ tenantId: TENANT_A, tenantRole: 'owner' })
        .expect(200);
      expect(res.body.data.tenantRole).toBe('owner');
    });

    it('nobody writes their own grant', async () => {
      const res = await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${ADMIN}/access`)
        .set('Authorization', asUser(ADMIN))
        .send({ tenantId: TENANT_A, tenantRole: 'viewer' })
        .expect(400);
      expect(res.body.error.message).toMatch(/akun Anda sendiri/);
    });

    it('a grant for a tenant outside the hub is refused', async () => {
      await seedMembership(CASHIER, HUB, 'viewer');
      const res = await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${CASHIER}/access`)
        .set('Authorization', asUser(ADMIN))
        .send({ tenantId: TENANT_OUTSIDE, tenantRole: 'viewer' })
        .expect(400);
      expect(res.body.error.message).toMatch(/tenant|Tenant/);
    });

    it('400 for a missing or invalid tenantRole', async () => {
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${CASHIER}/access`)
        .set('Authorization', asUser(ADMIN))
        .send({ tenantId: TENANT_A })
        .expect(400);
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${CASHIER}/access`)
        .set('Authorization', asUser(ADMIN))
        .send({ tenantId: TENANT_A, tenantRole: 'boss' })
        .expect(400);
    });
  });

  describe('ALLOW — member lifecycle', () => {
    it('an owner adds a member of the hub and it shows up in the read surface', async () => {
      const res = await request(ctx.app)
        .post(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(OWNER))
        .send({ userId: CASHIER, role: 'manager' })
        .expect(201);
      expect(res.body.data.role).toBe('manager');

      const membership = await ctx.membershipRepo.findByHubAndUser(HUB, CASHIER);
      expect(membership?.serialize().role).toBe('manager');
    });

    it('an owner changes a role, suspends and reactivates a member', async () => {
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${MANAGER}`)
        .set('Authorization', asUser(OWNER))
        .send({ role: 'admin' })
        .expect(200);

      const suspended = await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${MANAGER}/status`)
        .set('Authorization', asUser(OWNER))
        .send({ status: 'suspended' })
        .expect(200);
      expect(suspended.body.data.status).toBe('suspended');

      const back = await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${MANAGER}/status`)
        .set('Authorization', asUser(OWNER))
        .send({ status: 'active' })
        .expect(200);
      expect(back.body.data.status).toBe('active');
    });

    it('a repeated status is rejected instead of silently succeeding', async () => {
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${MANAGER}/status`)
        .set('Authorization', asUser(OWNER))
        .send({ status: 'suspended' })
        .expect(200);
      const res = await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${MANAGER}/status`)
        .set('Authorization', asUser(OWNER))
        .send({ status: 'suspended' })
        .expect(400);
      expect(res.body.error.message).toMatch(/sudah ditangguhkan/);
    });

    it('status must be explicit', async () => {
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${MANAGER}/status`)
        .set('Authorization', asUser(OWNER))
        .send({})
        .expect(400);
    });

    it('removing a member also suspends their grants (Fase 17 tombstone)', async () => {
      await seedMembership(CASHIER, HUB, 'viewer');
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${CASHIER}/access`)
        .set('Authorization', asUser(ADMIN))
        .send({ tenantId: TENANT_A, tenantRole: 'viewer' })
        .expect(200);

      await request(ctx.app)
        .delete(`/api/hub/${HUB}/members/${CASHIER}`)
        .set('Authorization', asUser(ADMIN))
        .expect(204);

      expect(await ctx.membershipRepo.findByHubAndUser(HUB, CASHIER)).toBeNull();
    });

    it('404 for a member that is not in this hub', async () => {
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${OUTSIDER}`)
        .set('Authorization', asUser(OWNER))
        .send({ role: 'viewer' })
        .expect(404);
      await request(ctx.app)
        .delete(`/api/hub/${HUB}/members/${OUTSIDER}`)
        .set('Authorization', asUser(OWNER))
        .expect(404);
    });
  });

  describe('ALLOW — access grants', () => {
    it('an admin grants, narrows and revokes access for another member', async () => {
      await seedMembership(CASHIER, HUB, 'viewer');
      const granted = await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${CASHIER}/access`)
        .set('Authorization', asUser(ADMIN))
        .send({ tenantId: TENANT_A, tenantRole: 'manager' })
        .expect(200);
      expect(granted.body.data.tenantRole).toBe('manager');

      const list = await request(ctx.app)
        .get(`/api/hub/${HUB}/members/${CASHIER}/access`)
        .set('Authorization', asUser(MANAGER))
        .expect(200);
      expect(list.body.data).toHaveLength(1);

      const revoked = await request(ctx.app)
        .delete(`/api/hub/${HUB}/members/${CASHIER}/access/${TENANT_A}`)
        .set('Authorization', asUser(ADMIN))
        .expect(204);
      expect(revoked.status).toBe(204);
      // Revoke is a tombstone, not a delete (Fase 17): deleting the last row would
      // drop the member back into the ADR D3 zero-grant fallback.
      const after = await request(ctx.app)
        .get(`/api/hub/${HUB}/members/${CASHIER}/access`)
        .set('Authorization', asUser(MANAGER))
        .expect(200);
      expect(after.body.data).toHaveLength(1);
      expect(after.body.data[0].status).toBe('suspended');
    });

    it('revoking twice is an error, not a silent no-op', async () => {
      await seedMembership(CASHIER, HUB, 'viewer');
      await request(ctx.app)
        .put(`/api/hub/${HUB}/members/${CASHIER}/access`)
        .set('Authorization', asUser(ADMIN))
        .send({ tenantId: TENANT_A, tenantRole: 'viewer' })
        .expect(200);
      await request(ctx.app)
        .delete(`/api/hub/${HUB}/members/${CASHIER}/access/${TENANT_A}`)
        .set('Authorization', asUser(ADMIN))
        .expect(204);
      const res = await request(ctx.app)
        .delete(`/api/hub/${HUB}/members/${CASHIER}/access/${TENANT_A}`)
        .set('Authorization', asUser(ADMIN))
        .expect(400);
      expect(res.body.error.message).toMatch(/already revoked/);
    });
  });

  describe('ALLOW — invitations', () => {
    it('an admin invites by email and the token is returned exactly once', async () => {
      const res = await request(ctx.app)
        .post(`/api/hub/${HUB}/invitations`)
        .set('Authorization', asUser(ADMIN))
        .send({ email: ' Tamu@Test.Local ', role: 'viewer' })
        .expect(201);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.invitation.email).toBe('tamu@test.local');
      expect(res.body.data.invitation.tokenHash).toBeUndefined();

      const list = await request(ctx.app)
        .get(`/api/hub/${HUB}/invitations`)
        .set('Authorization', asUser(MANAGER))
        .expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].tokenHash).toBeUndefined();
      expect(list.body.data[0].token).toBeUndefined();
    });

    it('an admin cannot invite at owner level', async () => {
      await request(ctx.app)
        .post(`/api/hub/${HUB}/invitations`)
        .set('Authorization', asUser(ADMIN))
        .send({ email: 'tamu@test.local', role: 'owner' })
        .expect(400);
    });

    it('an admin revokes an invitation', async () => {
      const created = await request(ctx.app)
        .post(`/api/hub/${HUB}/invitations`)
        .set('Authorization', asUser(ADMIN))
        .send({ email: 'tamu@test.local', role: 'viewer' })
        .expect(201);

      const res = await request(ctx.app)
        .delete(`/api/hub/${HUB}/invitations/${created.body.data.invitation.id}`)
        .set('Authorization', asUser(ADMIN))
        .expect(200);
      expect(res.body.data.status).toBe('revoked');
    });
  });

  describe('audit trail', () => {
    it('attributes the mutation to the hub member, not to `system`', async () => {
      await request(ctx.app)
        .post(`/api/hub/${HUB}/members`)
        .set('Authorization', asUser(ADMIN))
        .send({ userId: CASHIER, role: 'viewer' })
        .expect(201);

      const logs = await ctx.auditModel
        .find({ action: 'MEMBER_ADDED' })
        .sort({ createdAt: -1 })
        .limit(1)
        .lean();
      expect(logs).toHaveLength(1);
      expect(logs[0].actorId).toBe(ADMIN);
      expect(logs[0].actorEmail).toBe(`${ADMIN}@test.local`);
      expect(logs[0].actorRole).toBe('Hub Admin');
    });

    it('never stores the raw invitation token', async () => {
      const created = await request(ctx.app)
        .post(`/api/hub/${HUB}/invitations`)
        .set('Authorization', asUser(ADMIN))
        .send({ email: 'tamu@test.local', role: 'viewer' })
        .expect(201);
      const token = created.body.data.token as string;

      const logs = await ctx.auditModel.find({ action: 'INVITATION_SENT' }).lean();
      expect(JSON.stringify(logs)).not.toContain(token);
    });
  });
});
