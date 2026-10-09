import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import request from 'supertest';
import express, { Express } from 'express';
import { makeHub } from '../fixtures/hub.fixtures';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { HubMembershipSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMembershipSchema';
import { HubMemberTenantAccessSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubMemberTenantAccessSchema';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { SessionSchema } from '../../src/core/identity/infrastructure/persistence/schemas/SessionSchema';

import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { MongoHubRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubRepository';
import { MongoHubMembershipRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMembershipRepository';
import { MongoHubMemberTenantAccessRepository } from '../../src/core/hub/infrastructure/persistence/MongoHubMemberTenantAccessRepository';
import { MongoUserRepository } from '../../src/core/identity/infrastructure/persistence/MongoUserRepository';

import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { User } from '../../src/core/identity/domain/User';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';

import { AuthService } from '../../src/core/identity/application/services/AuthService';
import { AuthController } from '../../src/core/identity/interfaces/http/controllers/AuthController';
import { TokenService } from '../../src/core/identity/application/services/TokenService';
import { PasswordService } from '../../src/core/identity/domain/services/PasswordService';
import { SessionService } from '../../src/core/identity/application/services/SessionService';
import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';
import { HubMemberAccessService } from '../../src/core/hub/application/services/HubMemberAccessService';
import { HubMembershipController } from '../../src/core/hub/interfaces/http/controllers/HubMembershipController';
import { createAuthRoutes } from '../../src/core/identity/interfaces/http/routes/auth.routes';
import { createHubContextRoutes } from '../../src/core/hub/interfaces/http/routes/hubcontext.routes';
import { tenantContext } from '../../src/@shared/interfaces/middleware/tenantContext';
import { authenticate } from '../../src/@shared/interfaces/middleware/authenticate';
import { asyncHandler } from '../../src/@shared/interfaces/middleware/asyncHandler';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { Router, Request, Response } from 'express';

const HUB = 'hub-1';
const TENANT_ACTIVE = 'tenant-aktif';
const TENANT_SUSPENDED = 'tenant-ditangguhkan';

const MEMBER = 'user-member';
const NONMEMBER = 'user-nonmember';
const SUSPENDED_MEMBER = 'user-suspended-member';
const PASSWORD = 'secret123';

interface Ctx {
  app: Express;
  userRepo: MongoUserRepository;
  membershipRepo: MongoHubMembershipRepository;
  tenantRepo: MongoTenantRepository;
  passwordService: PasswordService;
  hashedPassword: string;
  hubRepo: MongoHubRepository;
}

let ctx: Ctx;

beforeAll(async () => {
  await setupTestDb();
  const c = mongoose.connection;

  const tenantRepo = new MongoTenantRepository(c.model('Tenant', TenantSchema));
  const hubRepo = new MongoHubRepository(c.model('Hub', HubSchema));
  const membershipRepo = new MongoHubMembershipRepository(c.model('HubMembership', HubMembershipSchema));
  const accessRepo = new MongoHubMemberTenantAccessRepository(
    c.model('HubMemberTenantAccess', HubMemberTenantAccessSchema),
  );
  const userRepo = new MongoUserRepository(c.model('User', UserSchema));
  const sessionRepo = new SessionService(c.model('Session', SessionSchema));
  const passwordService = new PasswordService();
  const hashedPassword = await passwordService.hash(PASSWORD);

  const accessService = new HubMemberAccessService({
    accessRepository: accessRepo,
    hubMembershipRepository: membershipRepo,
    hubRepository: hubRepo,
    tenantRepository: tenantRepo,
    outletRepository: undefined as any,
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
    passwordService,
    sessionRepo,
    undefined,
    hubMembershipService,
    accessService,
    tenantRepo,
  );

  const app = express();
  app.use(express.json());
  app.use(tenantContext);
  app.use('/api/auth', createAuthRoutes(new AuthController(authService)));
  app.use(
    '/api/hub-context',
    createHubContextRoutes(new HubMembershipController(hubMembershipService, undefined, accessService)),
  );

  // Probe wired with the real `authenticate` so the hub session's tenant scope is
  // observable: it must be the sentinel `hub`, never a real tenant id.
  const probe = Router();
  probe.get(
    '/tenant-scope',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
      res.json({ tenantId: req.tenantId });
    }),
  );
  app.use('/api/probe', probe);
  app.use(errorHandler);

  ctx = { app, userRepo, membershipRepo, tenantRepo, hubRepo, passwordService, hashedPassword };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

function seedTenant(id: string, name: string, slug: string, hubId: string | null, status = 'active') {
  return ctx.tenantRepo.save(
    Tenant.hydrate({
      id,
      name,
      slug,
      domain: null,
      ownerId: `owner-${id}`,
      plan: 'trial',
      status,
      businessType: 'restaurant',
      modules: ['pos'],
      databaseName: `posmono_${slug}`,
      config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
      billingEmail: `${slug}@test.local`,
      hubId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any),
  );
}

function seedUser(id: string, tenantId: string, isActive = true) {
  return ctx.userRepo.save(
    User.hydrate({
      id,
      tenantId,
      email: `${id}@test.local`,
      passwordHash: ctx.hashedPassword,
      displayName: id,
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

/** One hub + one active tenant + one suspended tenant + three users. */
async function seedBase() {
  await ctx.hubRepo.save(makeHub({ id: HUB, name: 'BCA Hospitality', code: 'BCA' }));
  await seedTenant(TENANT_ACTIVE, 'Aktif Kopi', 'aktif-kopi', HUB, 'active');
  await seedTenant(TENANT_SUSPENDED, 'Ditangguhkan Resto', 'ditangguhkan-resto', HUB, 'suspended');
  await seedUser(MEMBER, TENANT_SUSPENDED);
  await seedUser(NONMEMBER, TENANT_ACTIVE);
  await seedUser(SUSPENDED_MEMBER, TENANT_ACTIVE);
  await seedMembership(MEMBER, HUB, 'viewer');
  await seedMembership(SUSPENDED_MEMBER, HUB, 'viewer', 'suspended');
}

beforeEach(async () => {
  await clearCollections();
});

describe('Hub console login (/auth/hub-login) — Fase 25', () => {
  it('ALLOW: member whose home tenant is suspended still enters the hub console', async () => {
    await seedBase();

    const res = await request(ctx.app).post('/api/auth/hub-login').send({
      email: `${MEMBER}@test.local`,
      password: PASSWORD,
    });

    expect(res.status).toBe(200);
    const token = res.body.data.accessToken as string;
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload.tenant).toBe('hub');
    expect(payload.permissions).toEqual([]);
    expect(res.body.data.hubs).toHaveLength(1);
    expect(res.body.data.hubs[0].id).toBe(HUB);

    // The hub session is good for hub surfaces…
    const context = await request(ctx.app)
      .get('/api/hub-context/me')
      .set('Authorization', `Bearer ${token}`);
    expect(context.status).toBe(200);
    expect(context.body.data.hubs.map((h: any) => h.id)).toContain(HUB);
    expect(context.body.data.blocked).toBeNull();

    // …but carries no tenant authority: scoped to the sentinel, not a real tenant.
    const scope = await request(ctx.app)
      .get('/api/probe/tenant-scope')
      .set('Authorization', `Bearer ${token}`);
    expect(scope.status).toBe(200);
    expect(scope.body.tenantId).toBe('hub');
  });

  it('ALLOW: the member can still switch into a healthy tenant of the hub', async () => {
    await seedBase();

    const login = await request(ctx.app).post('/api/auth/hub-login').send({
      email: `${MEMBER}@test.local`,
      password: PASSWORD,
    });
    const token = login.body.data.accessToken as string;

    const switched = await request(ctx.app)
      .post('/api/auth/switch-tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: TENANT_ACTIVE });

    expect(switched.status).toBe(200);
    const switchedPayload = JSON.parse(
      Buffer.from((switched.body.data.accessToken as string).split('.')[1], 'base64').toString(),
    );
    expect(switchedPayload.tenant).toBe(TENANT_ACTIVE);
  });

  it('DENY: switch-tenant into a suspended tenant still refuses (hub session does not bypass the tenant gate)', async () => {
    await seedBase();

    const login = await request(ctx.app).post('/api/auth/hub-login').send({
      email: `${MEMBER}@test.local`,
      password: PASSWORD,
    });
    const token = login.body.data.accessToken as string;

    const switched = await request(ctx.app)
      .post('/api/auth/switch-tenant')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: TENANT_SUSPENDED });

    expect(switched.status).toBe(403);
    expect(switched.body.error.message).toContain('ditangguhkan');
  });

  it('DENY: non-member gets 403 and no token', async () => {
    await seedBase();

    const res = await request(ctx.app).post('/api/auth/hub-login').send({
      email: `${NONMEMBER}@test.local`,
      password: PASSWORD,
    });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('bukan anggota hub');
  });

  it('DENY: suspended membership cannot sign into the console', async () => {
    await seedBase();

    const res = await request(ctx.app).post('/api/auth/hub-login').send({
      email: `${SUSPENDED_MEMBER}@test.local`,
      password: PASSWORD,
    });

    expect(res.status).toBe(403);
  });

  it('DENY: wrong password stays a plain 401 without revealing membership state', async () => {
    await seedBase();

    const res = await request(ctx.app).post('/api/auth/hub-login').send({
      email: `${MEMBER}@test.local`,
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
  });

  it('DENY: unknown email is a plain 401', async () => {
    await seedBase();

    const res = await request(ctx.app).post('/api/auth/hub-login').send({
      email: 'nobody@test.local',
      password: PASSWORD,
    });

    expect(res.status).toBe(401);
  });
});