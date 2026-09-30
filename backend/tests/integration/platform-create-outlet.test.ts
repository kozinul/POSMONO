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

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { OutletSchema } from '../../src/core/outlet/infrastructure/persistence/schemas/OutletSchema';
import { WarehouseSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/WarehouseSchema';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';

import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { OutletController } from '../../src/core/outlet/interfaces/http/controllers/OutletController';
import { OutletService } from '../../src/core/outlet/application/services/OutletService';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { HubService } from '../../src/core/hub/application/services/HubService';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { PlatformController } from '../../src/core/platform/interfaces/http/controllers/PlatformController';
import { createPlatformRoutes } from '../../src/core/platform/interfaces/http/routes/platform.routes';
import { createOutletRoutes } from '../../src/core/outlet/interfaces/http/routes/outlet.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';

const TENANT_ID = 'tenant-kopibali';
const HUB_ID = 'hub-bali';

let ctx: {
  app: Express;
  tenantRepo: MongoTenantRepository;
  outletRepo: MongoOutletRepository;
  warehouseRepo: MongoWarehouseRepository;
  platformToken: string;
  platformTokenNoOutletManage: string;
  tenantToken: string;
};

function seedTenant(repo: MongoTenantRepository) {
  const tenant = Tenant.hydrate({
    id: TENANT_ID,
    name: 'Kopi Bali Sejahtera',
    slug: 'kopi-bali',
    domain: null,
    ownerId: 'owner-1',
    plan: 'trial',
    status: 'trial',
    businessType: 'restaurant',
    modules: ['pos'],
    databaseName: 'posmono_kopi_bali',
    config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
    billingEmail: 'support@kopibali.com',
    hubId: HUB_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  return repo.save(tenant);
}

beforeAll(async () => {
  await setupTestDb();

  const tenantModel = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);
  const hubModel = mongoose.models.Hub || mongoose.model('Hub', HubSchema);
  const outletModel = mongoose.models.Outlet || mongoose.model('Outlet', OutletSchema);
  const warehouseModel = mongoose.models.Warehouse || mongoose.model('Warehouse', WarehouseSchema);
  const shiftModel = mongoose.models.Shift || mongoose.model('Shift', ShiftSchema);
  const paymentModel = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

  const tenantRepo = new MongoTenantRepository(tenantModel);
  const outletRepo = new MongoOutletRepository(outletModel);
  const warehouseRepo = new MongoWarehouseRepository(warehouseModel);
  const outletService = new OutletService(outletRepo, warehouseRepo);
  const tenantService = new TenantService(tenantRepo);
  const hubRepo = new MongoHubRepository(hubModel);
  const hubService = new HubService(hubRepo, tenantRepo);
  const shiftService = new ShiftService(new MongoShiftRepository(shiftModel));
  const paymentService = new PaymentService({
    paymentRepository: new MongoPaymentRepository(paymentModel),
  });

  const platformController = new PlatformController({
    hubService,
    tenantService,
    outletService,
    shiftService,
    paymentService,
    tenantRepository: tenantRepo,
    hubRepository: hubRepo as any,
    provisionTenantService: undefined,
  });

  const outletController = new OutletController(outletService);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/platform', createPlatformRoutes(platformController));
  app.use('/api/outlets', createOutletRoutes(outletController));
  app.use(errorHandler);

  ctx = {
    app,
    tenantRepo,
    outletRepo,
    warehouseRepo,
    platformToken: generateTestToken({
      sub: 'platform-admin',
      tenant: 'platform',
      role: 'platform-super-admin',
      permissions: PLATFORM_ROLE_PERMS,
    }),
    platformTokenNoOutletManage: generateTestToken({
      sub: 'platform-viewer',
      tenant: 'platform',
      role: 'platform-viewer',
      permissions: ['platform.tenants.read'],
    }),
    tenantToken: generateTestToken({
      sub: 'owner-1',
      tenant: TENANT_ID,
      role: 'owner',
      permissions: ['outlet:manage'],
    }),
  };
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
  await seedTenant(ctx.tenantRepo);
});

const platformAuth = () => `Bearer ${ctx.platformToken}`;
const tenantAuth = () => `Bearer ${ctx.tenantToken}`;

describe('Platform Outlet Creation (POST /api/platform/outlets)', () => {
  const validPayload = {
    tenantId: TENANT_ID,
    name: 'Cabang Kuta',
    address: 'Jl. Raya Kuta No. 1',
    phone: '08123456789',
  };

  it('creates outlet with linked warehouse 1:1 for platform super admin', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/outlets')
      .set('Authorization', platformAuth())
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Cabang Kuta');
    expect(res.body.data.tenantId).toBe(TENANT_ID);
    expect(res.body.data.tenantName).toBe('Kopi Bali Sejahtera');
    expect(res.body.data.warehouseId).not.toBeNull();

    const outletInDb = await ctx.outletRepo.findById(res.body.data.id);
    expect(outletInDb).not.toBeNull();
    expect(outletInDb?.serialize().warehouseId).toBe(res.body.data.warehouseId);

    const warehouses = await ctx.warehouseRepo.findByTenant(TENANT_ID);
    expect(warehouses).toHaveLength(1);
    expect(warehouses[0].serialize().name).toBe('Warehouse Cabang Kuta');
    expect(warehouses[0].serialize().outletId).toBe(res.body.data.id);
  });

  it('returns 404 when tenant does not exist', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/outlets')
      .set('Authorization', platformAuth())
      .send({ ...validPayload, tenantId: 'nonexistent-tenant' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for validation errors', async () => {
    const noTenant = await request(ctx.app)
      .post('/api/platform/outlets')
      .set('Authorization', platformAuth())
      .send({ name: 'Cabang X' });
    expect(noTenant.status).toBe(400);

    const noName = await request(ctx.app)
      .post('/api/platform/outlets')
      .set('Authorization', platformAuth())
      .send({ tenantId: TENANT_ID });
    expect(noName.status).toBe(400);
  });

  it('returns 409 when outlet name already exists for the tenant', async () => {
    await request(ctx.app)
      .post('/api/platform/outlets')
      .set('Authorization', platformAuth())
      .send(validPayload);

    const res = await request(ctx.app)
      .post('/api/platform/outlets')
      .set('Authorization', platformAuth())
      .send(validPayload);

    expect(res.status).toBe(409);
  });

  it('rejects non-platform session (tenant session)', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/outlets')
      .set('Authorization', tenantAuth())
      .send(validPayload);

    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/outlets')
      .send(validPayload);

    expect(res.status).toBe(401);
  });

  it('rejects platform session without outlet:manage permission (403)', async () => {
    const res = await request(ctx.app)
      .post('/api/platform/outlets')
      .set('Authorization', `Bearer ${ctx.platformTokenNoOutletManage}`)
      .send(validPayload);

    expect(res.status).toBe(403);
  });
});

describe('Tenant Outlet Mutations Removed (platform-only create/delete)', () => {
  it('tenant-level POST /api/outlets is gone (route removed)', async () => {
    const res = await request(ctx.app)
      .post('/api/outlets')
      .set('Authorization', tenantAuth())
      .send({ name: 'Cabang X' });

    expect(res.status).toBe(404);
  });

  it('tenant-level DELETE /api/outlets/:id is gone (route removed)', async () => {
    const res = await request(ctx.app)
      .delete('/api/outlets/some-outlet-id')
      .set('Authorization', tenantAuth());

    expect(res.status).toBe(404);
  });

  it('tenant can still read its outlets', async () => {
    const res = await request(ctx.app)
      .get('/api/outlets')
      .set('Authorization', tenantAuth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});