import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
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

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { OutletSchema } from '../../src/core/outlet/infrastructure/persistence/schemas/OutletSchema';
import { WarehouseSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/WarehouseSchema';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { RoleSchema } from '../../src/core/identity/infrastructure/persistence/schemas/RoleSchema';

import { Hub } from '../../src/core/hub/domain/Hub';
import { HubService } from '../../src/core/hub/application/services/HubService';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { OutletService } from '../../src/core/outlet/application/services/OutletService';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { ProvisionTenantService } from '../../src/core/platform/application/services/ProvisionTenantService';
import { PlatformController } from '../../src/core/platform/interfaces/http/controllers/PlatformController';
import { createPlatformRoutes } from '../../src/core/platform/interfaces/http/routes/platform.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';

let ctx: {
  app: Express;
  tenantRepo: MongoTenantRepository;
  hubRepo: MongoHubRepository;
  outletRepo: MongoOutletRepository;
  warehouseRepo: MongoWarehouseRepository;
  userRepo: MongoUserRepository;
  roleRepo: MongoRoleRepository;
  platformToken: string;
  tenantToken: string;
};

const HUB_ID = 'hub-bali-group';

beforeAll(async () => {
  await setupTestDb();

  const tenantModel = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);
  const hubModel = mongoose.models.Hub || mongoose.model('Hub', HubSchema);
  const outletModel = mongoose.models.Outlet || mongoose.model('Outlet', OutletSchema);
  const warehouseModel = mongoose.models.Warehouse || mongoose.model('Warehouse', WarehouseSchema);
  const shiftModel = mongoose.models.Shift || mongoose.model('Shift', ShiftSchema);
  const paymentModel = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
  const userModel = mongoose.models.User || mongoose.model('User', UserSchema);
  const roleModel = mongoose.models.Role || mongoose.model('Role', RoleSchema);

  const tenantRepo = new MongoTenantRepository(tenantModel);
  const hubRepo = new MongoHubRepository(hubModel);
  const outletRepo = new MongoOutletRepository(outletModel);
  const warehouseRepo = new MongoWarehouseRepository(warehouseModel);
  const shiftRepo = new MongoShiftRepository(shiftModel);
  const paymentRepo = new MongoPaymentRepository(paymentModel);
  const userRepo = new MongoUserRepository(userModel);
  const roleRepo = new MongoRoleRepository(roleModel);

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

  const provisionTenantService = new ProvisionTenantService({
    tenantRepository: tenantRepo,
    userRepository: userRepo,
    roleRepository: roleRepo,
    hubRepository: hubRepo,
    outletService,
  });

  const platformController = new PlatformController({
    hubService,
    tenantService,
    outletService,
    shiftService,
    paymentService,
    tenantRepository: tenantRepo,
    hubRepository: hubRepo,
    provisionTenantService,
  });

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/platform', createPlatformRoutes(platformController));
  app.use(errorHandler);

  ctx = {
    app,
    tenantRepo,
    hubRepo,
    outletRepo,
    warehouseRepo,
    userRepo,
    roleRepo,
    platformToken: generateTestToken({
      sub: 'platform-admin',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: PLATFORM_ROLE_PERMS,
    }),
    tenantToken: generateTestToken({
      sub: 'regular-user',
      tenant: 'tenant-test',
      role: 'owner',
      permissions: ['hub:manage'],
    }),
  };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
  const hub = Hub.hydrate({
    id: HUB_ID,
    name: 'Bali Hospitality Group',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  await ctx.hubRepo.save(hub);
});

const platformAuth = () => `Bearer ${ctx.platformToken}`;
const tenantAuth = () => `Bearer ${ctx.tenantToken}`;

describe('Platform Provisioning API (POST /api/platform/provision/tenant)', () => {
  const validPayload = {
    tenant: {
      name: 'Kopi Bali Sejahtera',
      businessType: 'restaurant',
    },
    owner: {
      name: 'Budi',
      email: 'budi@kopibali.com',
      password: 'mypassword123',
    },
    outlet: {
      name: 'Kopi Bali Sanur',
      address: 'Jl. Danau Tamblingan No. 12',
      phone: '08123456789',
    },
    hubId: null,
  };

  it('provisions a new tenant successfully for platform super admin', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/provision/tenant')
      .set('Authorization', platformAuth())
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ready');
    expect(res.body.data.tenant.name).toBe('Kopi Bali Sejahtera');
    expect(res.body.data.tenant.hubId).toBeNull();
    expect(res.body.data.owner.name).toBe('Budi');
    expect(res.body.data.owner.email).toBe('budi@kopibali.com');
    expect(res.body.data.outlet.name).toBe('Kopi Bali Sanur');
    expect(res.body.data.warehouse.name).toBe('Warehouse Utama');
    expect(res.body.data.owner.password).toBeUndefined();

    // Verify in MongoDB
    const tenantId = res.body.data.tenant.id;
    const tenantInDb = await ctx.tenantRepo.findById(tenantId);
    expect(tenantInDb).not.toBeNull();
    expect(tenantInDb?.serialize().name).toBe('Kopi Bali Sejahtera');

    const users = await ctx.userRepo.findByTenant(tenantId);
    expect(users).toHaveLength(1);
    expect(users[0].serialize().displayName).toBe('Budi');
    expect(users[0].serialize().outletIds).toEqual([]);

    const outlets = await ctx.outletRepo.findByTenant(tenantId);
    expect(outlets).toHaveLength(1);
    expect(outlets[0].serialize().name).toBe('Kopi Bali Sanur');
    expect(outlets[0].serialize().warehouseId).toBe('utama');

    const warehouses = await ctx.warehouseRepo.findByTenant(tenantId);
    expect(warehouses).toHaveLength(1);
    expect(warehouses[0].serialize().outletId).toBe(outlets[0].serialize().id);

    const roles = await ctx.roleRepo.findByTenant(tenantId);
    expect(roles.length).toBeGreaterThanOrEqual(3);
  });

  it('provisions a tenant attached to a Hub when hubId is provided', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/provision/tenant')
      .set('Authorization', platformAuth())
      .send({ ...validPayload, hubId: HUB_ID });

    expect(res.status).toBe(201);
    expect(res.body.data.tenant.hubId).toBe(HUB_ID);

    const tenantInDb = await ctx.tenantRepo.findById(res.body.data.tenant.id);
    expect(tenantInDb?.serialize().hubId).toBe(HUB_ID);
  });

  it('rejects non-platform session (tenant session)', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/provision/tenant')
      .set('Authorization', tenantAuth())
      .send(validPayload);

    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/provision/tenant')
      .send(validPayload);

    expect(res.status).toBe(401);
  });

  it('returns 404 when hubId does not exist', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/provision/tenant')
      .set('Authorization', platformAuth())
      .send({ ...validPayload, hubId: 'nonexistent-hub-id' });

    expect(res.status).toBe(404);
  });

  it('returns 409 when owner email is already registered', async () => {
    // First provision
    const res1 = await request(ctx.app)
      .post('/api/platform/provision/tenant')
      .set('Authorization', platformAuth())
      .send(validPayload);
    expect(res1.status).toBe(201);

    // Second provision with same email
    const res2 = await request(ctx.app)
      .post('/api/platform/provision/tenant')
      .set('Authorization', platformAuth())
      .send({
        ...validPayload,
        tenant: { name: 'Different Tenant' },
        outlet: { name: 'Different Outlet' },
      });

    expect(res2.status).toBe(409);
  });

  it('returns 400 for validation errors', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/provision/tenant')
      .set('Authorization', platformAuth())
      .send({
        ...validPayload,
        tenant: { name: '' },
      });

    expect(res.status).toBe(400);
  });

  it('re-uses result when Idempotency-Key header is provided', async () => {
    const key = 'idem-unique-key-456';
    const res1 = await request(ctx.app)
      .post('/api/platform/provision/tenant')
      .set('Authorization', platformAuth())
      .set('Idempotency-Key', key)
      .send(validPayload);

    expect(res1.status).toBe(201);

    const res2 = await request(ctx.app)
      .post('/api/platform/provision/tenant')
      .set('Authorization', platformAuth())
      .set('Idempotency-Key', key)
      .send(validPayload);

    expect(res2.status).toBe(201);
    expect(res1.body.data.tenant.id).toBe(res2.body.data.tenant.id);
  });
});
