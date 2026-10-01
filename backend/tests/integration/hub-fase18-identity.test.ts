import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import request from 'supertest';
import express, { Express, Router, Request, Response } from 'express';
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
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { User } from '../../src/core/identity/domain/User';
import { Outlet } from '../../src/core/outlet/domain/Outlet';

import { HubService } from '../../src/core/hub/application/services/HubService';
import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';
import { HubMemberAccessService } from '../../src/core/hub/application/services/HubMemberAccessService';
import { AuthService } from '../../src/core/identity/application/services/AuthService';
import { TokenService } from '../../src/core/identity/application/services/TokenService';
import { PasswordService } from '../../src/core/identity/domain/services/PasswordService';
import { SessionService } from '../../src/core/identity/application/services/SessionService';
import { PlatformController } from '../../src/core/platform/interfaces/http/controllers/PlatformController';
import { HubController } from '../../src/core/hub/interfaces/http/controllers/HubController';
import { AuthController } from '../../src/core/identity/interfaces/http/controllers/AuthController';
import { HubMembershipController } from '../../src/core/hub/interfaces/http/controllers/HubMembershipController';

import { createHubRoutes } from '../../src/core/hub/interfaces/http/routes/hub.routes';
import { createPlatformRoutes } from '../../src/core/platform/interfaces/http/routes/platform.routes';
import { createHubMembershipRoutes } from '../../src/core/hub/interfaces/http/routes/hubmembership.routes';
import { createHubContextRoutes } from '../../src/core/hub/interfaces/http/routes/hubcontext.routes';
import { createAuthRoutes } from '../../src/core/identity/interfaces/http/routes/auth.routes';
import { tenantContext } from '../../src/@shared/interfaces/middleware/tenantContext';
import { authenticate } from '../../src/@shared/interfaces/middleware/authenticate';
import { asyncHandler } from '../../src/@shared/interfaces/middleware/asyncHandler';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { PERMISSIONS } from '@posmono/shared';

const HUB = 'hub-1';
const TENANT_A = 'tenant-alpha';
const MEMBER = 'member-user';
const HUB_OWNER = 'owner-a';

let ctx: {
  app: Express;
  hubRepo: InstanceType<typeof MongoHubRepository>;
  tenantRepo: InstanceType<typeof MongoTenantRepository>;
  accessService: HubMemberAccessService;
  hubService: HubService;
  platformToken: string;
  memberToken: string;
};

function platformToken() {
  return jwt.sign(
    {
      sub: 'platform-admin',
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

function memberToken() {
  return jwt.sign(
    { sub: MEMBER, tenant: TENANT_A, role: 'user', roleName: 'Member', permissions: [], outletIds: [] },
    TEST_SECRET,
    { expiresIn: '15m' },
  );
}

const platformAuth = () => `Bearer ${ctx.platformToken}`;
const platformScope = { 'X-Tenant-Id': 'platform' };

function seedTenant(id: string, hubId?: string) {
  return ctx.tenantRepo.save(
    Tenant.hydrate({
      id,
      name: id,
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

  const hubService = new HubService(hubRepo, tenantRepo);

  const authService = new AuthService(
    userRepo,
    new TokenService(),
    new PasswordService(),
    new SessionService(sessionModel),
    undefined,
    hubMembershipService,
    accessService,
  );

  const platformController = new PlatformController({
    hubService,
    hubRepository: hubRepo,
    tenantService: { list: async () => ({ data: [], total: 0, page: 1, limit: 50 }) },
    tenantRepository: tenantRepo,
    outletService: { listAllForPlatform: async () => [] },
    shiftService: { getPlatformShiftsSummary: async () => ({}) },
    paymentService: { getPlatformPaymentsSummary: async () => ({}) },
    userRepository: userRepo,
  } as any);

  const app = express();
  app.use(express.json());
  app.use(tenantContext);
  app.use('/api/auth', createAuthRoutes(new AuthController(authService)));
  app.use('/api/hubs', createHubRoutes(new HubController(hubService)));
  app.use(
    '/api/platform',
    createPlatformRoutes(
      platformController,
      undefined,
      undefined,
      undefined,
      new HubMembershipController(hubMembershipService, undefined, accessService),
    ),
  );
  const membershipController = new HubMembershipController(hubMembershipService, undefined, accessService);
  app.use('/api/hub-memberships', createHubMembershipRoutes(membershipController));
  app.use('/api/hub-context', createHubContextRoutes(membershipController));
  app.use(errorHandler);

  ctx = { app, hubRepo, tenantRepo, accessService, hubService, platformToken: '', memberToken: '' };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
  ctx.platformToken = platformToken();
  ctx.memberToken = memberToken();

  await seedTenant(TENANT_A, HUB);
  await ctx.hubRepo.save(makeHub({ id: HUB, name: 'Group One' }));
});

async function seedUser(id: string, displayName: string) {
  const repo = mongoose.model('User', UserSchema);
  await new MongoUserRepository(repo).save(
    User.hydrate({
      id,
      tenantId: TENANT_A,
      email: `${id}@test.local`,
      passwordHash: 'x',
      displayName,
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

async function seedMembership(userId: string, role = 'owner') {
  const repo = new MongoHubMembershipRepository(mongoose.model('HubMembership', HubMembershipSchema));
  await repo.save(
    HubMembership.hydrate({
      id: `m-${userId}`,
      hubId: HUB,
      userId,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
}

async function setHubStatus(status: 'active' | 'suspended' | 'archived') {
  await mongoose.model('Hub', HubSchema).collection.updateOne({ _id: HUB }, { $set: { status } });
}

describe('Hub V2 Fase 18 — identity over HTTP', () => {
  it('derives an uppercase code when a hub is created', async () => {
    const res = await request(ctx.app)
      .post('/api/hubs')
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ name: 'Kopi Nusantara' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      code: 'KOPI-NUSANTARA',
      status: 'active',
      isActive: true,
      ownerUserId: null,
    });
  });

  it('accepts an explicit code and normalises it', async () => {
    const res = await request(ctx.app)
      .post('/api/hubs')
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ name: 'Saji Group', code: '  saji  group ' });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('SAJI-GROUP');
  });

  it('409s when two hubs would share a code', async () => {
    await ctx.hubRepo.save(makeHub({ id: 'hub-2', name: 'Saji Group' }));

    const res = await request(ctx.app)
      .post('/api/hubs')
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ name: 'Saji Group Dua', code: 'saji group' });

    expect(res.status).toBe(409);
  });

  it('400s on an invalid status and on a code with no usable characters', async () => {
    const badStatus = await request(ctx.app)
      .put(`/api/hubs/${HUB}`)
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ status: 'paused' });
    expect(badStatus.status).toBe(400);

    const badCode = await request(ctx.app)
      .put(`/api/hubs/${HUB}`)
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ code: '***' });
    expect(badCode.status).toBe(400);
  });

  it('stores the display-only owner and exposes it on the platform detail', async () => {
    await seedUser(HUB_OWNER, 'Owner Alpha');
    await seedMembership(HUB_OWNER, 'owner');

    const update = await request(ctx.app)
      .put(`/api/hubs/${HUB}`)
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ ownerUserId: HUB_OWNER });
    expect(update.status).toBe(200);
    expect(update.body.data.ownerUserId).toBe(HUB_OWNER);

    const detail = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB}`)
      .set('Authorization', platformAuth())
      .set(platformScope);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      code: 'GROUP-ONE',
      status: 'active',
      owner: { id: HUB_OWNER, name: 'Owner Alpha' },
    });
  });

  it('keeps the derived isActive mirror in step with status for pre-Fase 18 readers', async () => {
    const res = await request(ctx.app)
      .put(`/api/hubs/${HUB}`)
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ status: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'suspended', isActive: false });
  });
});

describe('Hub V2 Fase 18 — suspended and archived deny access', () => {
  beforeEach(async () => {
    await seedUser(MEMBER, 'Member User');
    await seedMembership(MEMBER, 'owner');
    await ctx.accessService.setAccess({
      hubId: HUB,
      userId: MEMBER,
      tenantId: TENANT_A,
      tenantRole: 'owner',
      outletIds: [],
    });
  });

  it('lists the tenant while the hub is active', async () => {
    const res = await request(ctx.app)
      .get('/api/auth/accessible-tenants')
      .set('Authorization', `Bearer ${ctx.memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((t: any) => t.tenantId ?? t.id)).toContain(TENANT_A);
  });

  it('hides the hub and its tenants once it is suspended', async () => {
    await setHubStatus('suspended');

    const res = await request(ctx.app)
      .get('/api/auth/accessible-tenants')
      .set('Authorization', `Bearer ${ctx.memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((t: any) => t.tenantId ?? t.id)).not.toContain(TENANT_A);

    const context = await request(ctx.app)
      .get('/api/hub-context/me')
      .set('Authorization', `Bearer ${ctx.memberToken}`);
    expect(context.status).toBe(200);
    expect(context.body.data.hubs).toEqual([]);
  });

  it('403s switch-tenant into a suspended hub', async () => {
    await setHubStatus('suspended');

    const res = await request(ctx.app)
      .post('/api/auth/switch-tenant')
      .set('Authorization', `Bearer ${ctx.memberToken}`)
      .send({ tenantId: TENANT_A });

    expect(res.status).toBe(403);
  });

  it('403s switch-tenant into an archived hub', async () => {
    await setHubStatus('archived');

    const res = await request(ctx.app)
      .post('/api/auth/switch-tenant')
      .set('Authorization', `Bearer ${ctx.memberToken}`)
      .send({ tenantId: TENANT_A });

    expect(res.status).toBe(403);
  });

  it('still lets the platform read an archived hub, and refuses profile edits', async () => {
    await setHubStatus('archived');

    const detail = await request(ctx.app)
      .get(`/api/platform/hubs/${HUB}`)
      .set('Authorization', platformAuth())
      .set(platformScope);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ status: 'archived', isActive: false });

    const edit = await request(ctx.app)
      .put(`/api/hubs/${HUB}`)
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ name: 'Nama Baru' });
    expect(edit.status).toBe(400);
  });

  it('lets an archived hub be re-opened by naming a target status', async () => {
    await setHubStatus('archived');

    const res = await request(ctx.app)
      .put(`/api/hubs/${HUB}`)
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'active', isActive: true });
  });

  it('refuses membership and grant mutation on an archived hub', async () => {
    await setHubStatus('archived');

    const addMember = await request(ctx.app)
      .post('/api/hub-memberships')
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ hubId: HUB, userId: HUB_OWNER, role: 'viewer' });
    expect(addMember.status).toBe(400);

    const grant = await request(ctx.app)
      .put(`/api/hub-memberships/hub/${HUB}/${HUB_OWNER}/access`)
      .set('Authorization', platformAuth())
      .set(platformScope)
      .send({ tenantId: TENANT_A, tenantRole: 'viewer', outletIds: [] });
    expect(grant.status).toBe(400);
  });
});

describe('Hub V2 Fase 18 — legacy hub migration', () => {
  it('serves a legacy hub (no code, no status) with both derived', async () => {
    await mongoose
      .model('Hub', HubSchema)
      .collection.insertOne({ _id: 'legacy-hub', name: 'Bali Group', description: null, isActive: true });

    const detail = await request(ctx.app)
      .get('/api/hubs/legacy-hub')
      .set('Authorization', platformAuth())
      .set(platformScope);

    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ code: 'BALI-GROUP', status: 'active', isActive: true });
  });

  it('does not bring a legacy deactivated hub back online', async () => {
    await mongoose
      .model('Hub', HubSchema)
      .collection.insertOne({ _id: 'legacy-off', name: 'Bali Group', description: null, isActive: false });

    const detail = await request(ctx.app)
      .get('/api/hubs/legacy-off')
      .set('Authorization', platformAuth())
      .set(platformScope);

    expect(detail.body.data).toMatchObject({ code: 'BALI-GROUP', status: 'suspended', isActive: false });
  });
});