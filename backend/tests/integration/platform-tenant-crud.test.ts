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
import { MongoUserRepository } from '../../src/core/identity/infrastructure/persistence/MongoUserRepository';
import { MongoShiftRepository } from '../../src/core/pos/infrastructure/persistence/MongoShiftRepository';
import { MongoPaymentRepository } from '../../src/core/payment/infrastructure/persistence/MongoPaymentRepository';
import { MongoPlatformAuditLogRepository } from '../../src/core/platform/audit/infrastructure/persistence/MongoPlatformAuditLogRepository';

import { ProductSchema } from '../../src/core/catalog/infrastructure/persistence/schemas/ProductSchema';
import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { HubSchema } from '../../src/core/hub/infrastructure/persistence/schemas/HubSchema';
import { OutletSchema } from '../../src/core/outlet/infrastructure/persistence/schemas/OutletSchema';
import { WarehouseSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/WarehouseSchema';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { PlatformAuditLogSchema } from '../../src/core/platform/audit/infrastructure/persistence/schemas/PlatformAuditLogSchema';

import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { OutletController } from '../../src/core/outlet/interfaces/http/controllers/OutletController';
import { OutletService } from '../../src/core/outlet/application/services/OutletService';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { HubService } from '../../src/core/hub/application/services/HubService';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { PlatformController } from '../../src/core/platform/interfaces/http/controllers/PlatformController';
import { PlatformCleanupService } from '../../src/core/platform/application/services/PlatformCleanupService';
import { PlatformAuditService } from '../../src/core/platform/audit/application/services/PlatformAuditService';
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
  userRepo: MongoUserRepository;
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

async function seedUser(repo: MongoUserRepository, tenantId: string, outletId?: string) {
  const userModel: any = mongoose.models.User;
  await userModel.create({
    _id: `user-${tenantId}`,
    tenantId,
    email: `owner+${tenantId}@example.com`,
    passwordHash: 'hashed',
    displayName: 'Owner Test',
    roleId: 'role-owner',
    isActive: true,
    outletIds: outletId ? [outletId] : [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

beforeAll(async () => {
  await setupTestDb();

  const tenantModel = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);
  const hubModel = mongoose.models.Hub || mongoose.model('Hub', HubSchema);
  const outletModel = mongoose.models.Outlet || mongoose.model('Outlet', OutletSchema);
  const warehouseModel = mongoose.models.Warehouse || mongoose.model('Warehouse', WarehouseSchema);
  const userModel = mongoose.models.User || mongoose.model('User', UserSchema);
  const shiftModel = mongoose.models.Shift || mongoose.model('Shift', ShiftSchema);
  const paymentModel = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
  const auditLogModel = mongoose.models.PlatformAuditLog || mongoose.model('PlatformAuditLog', PlatformAuditLogSchema);

  const tenantRepo = new MongoTenantRepository(tenantModel);
  const outletRepo = new MongoOutletRepository(outletModel);
  const warehouseRepo = new MongoWarehouseRepository(warehouseModel);
  const userRepo = new MongoUserRepository(userModel as any);
  const outletService = new OutletService(outletRepo, warehouseRepo);
  const tenantService = new TenantService(tenantRepo);
  const hubRepo = new MongoHubRepository(hubModel);
  const hubService = new HubService(hubRepo, tenantRepo);
  const shiftService = new ShiftService(new MongoShiftRepository(shiftModel));
  const paymentService = new PaymentService(
    new MongoPaymentRepository(paymentModel),
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
  const auditService = new PlatformAuditService(new MongoPlatformAuditLogRepository(auditLogModel));
  const cleanupService = new PlatformCleanupService(mongoose.connection);

  const platformController = new PlatformController({
    hubService,
    tenantService,
    outletService,
    shiftService,
    paymentService,
    tenantRepository: tenantRepo,
    hubRepository: hubRepo as any,
    provisionTenantService: undefined,
    auditService,
    cleanupService,
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
    userRepo,
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

describe('Platform Tenant Update (PUT /api/platform/tenants/:tenantId)', () => {
  it('updates tenant profile fields', async () => {
    const res = await request(ctx.app)
      .put(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', platformAuth())
      .send({ name: 'Kopi Bali Premium', businessType: 'cafe', address: 'Jl. Sunset Road 88', phone: '081234567' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Kopi Bali Premium');
    const updated = await ctx.tenantRepo.findById(TENANT_ID);
    expect(updated?.serialize().businessType).toBe('cafe');
    expect(updated?.serialize().address).toBe('Jl. Sunset Road 88');
  });

  it('unassigns hub when hubId is null', async () => {
    const res = await request(ctx.app)
      .put(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', platformAuth())
      .send({ hubId: null });

    expect(res.status).toBe(200);
    expect(res.body.data.hubId).toBeNull();
    const updated = await ctx.tenantRepo.findById(TENANT_ID);
    expect(updated?.serialize().hubId).toBeNull();
  });

  it('assigns hub when hubId provided', async () => {
    const { Hub } = await import('../../src/core/hub/domain/Hub');
    const hubRepo = new MongoHubRepository(mongoose.models.Hub as any);
    const hub = Hub.create({ name: 'Bali Group', description: null, isActive: true });
    await hubRepo.save(hub);

    const res = await request(ctx.app)
      .put(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', platformAuth())
      .send({ hubId: hub.serialize().id });

    expect(res.status).toBe(200);
    const updated = await ctx.tenantRepo.findById(TENANT_ID);
    expect(updated?.serialize().hubId).toBe(hub.serialize().id);
  });

  it('returns 404 when assigning unknown hub', async () => {
    const res = await request(ctx.app)
      .put(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', platformAuth())
      .send({ hubId: 'hub-tidak-ada' });

    expect(res.status).toBe(404);
  });

  it('rejects non-platform session', async () => {
    const res = await request(ctx.app)
      .put(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', tenantAuth())
      .send({ name: 'X' });

    expect(res.status).toBe(401);
  });

  it('rejects viewer without hub:manage permission', async () => {
    const res = await request(ctx.app)
      .put(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', `Bearer ${ctx.platformTokenNoOutletManage}`)
      .send({ name: 'X' });

    expect(res.status).toBe(403);
  });
});

describe('Platform Tenant Hard Delete (DELETE /api/platform/tenants/:tenantId)', () => {
  it('hard-deletes tenant and cascades tenant-scoped data', async () => {
    const userModel: any = mongoose.models.User;
    const productModel: any = mongoose.models.Product || mongoose.model('Product', ProductSchema);

    await userModel.create({
      _id: 'user-kopibali',
      tenantId: TENANT_ID,
      email: 'owner@kopibali.com',
      passwordHash: 'hashed',
      displayName: 'Owner',
      roleId: 'role-owner',
      isActive: true,
      outletIds: [],
    });
    await productModel.create({
      _id: 'product-kopi',
      tenantId: TENANT_ID,
      name: 'Kopi Susu',
      basePrice: 20000,
      categoryId: 'cat-1',
      familyId: null,
      isActive: true,
      sku: 'KS-1',
    });

    const res = await request(ctx.app)
      .delete(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', platformAuth())
      .send({ reason: 'penutupan bisnis' });

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(res.body.data.totalDeleted).toBeGreaterThanOrEqual(2);

    const tenantAfter = await ctx.tenantRepo.findById(TENANT_ID);
    expect(tenantAfter).toBeNull();
    const usersAfter = await userModel.countDocuments({ tenantId: TENANT_ID });
    expect(usersAfter).toBe(0);
    const productsAfter = await productModel.countDocuments({ tenantId: TENANT_ID });
    expect(productsAfter).toBe(0);

    const auditDoc = await mongoose.connection.collection('platform_audit_logs').findOne({ tenantId: TENANT_ID, action: 'TENANT_DELETED' });
    expect(auditDoc).not.toBeNull();
  });

  it('returns 404 for unknown tenant', async () => {
    const res = await request(ctx.app)
      .delete('/api/platform/tenants/nonexistent')
      .set('Authorization', platformAuth());

    expect(res.status).toBe(404);
  });
});

describe('Platform Outlet Update (PUT /api/platform/outlets/:outletId)', () => {
  it('updates outlet fields', async () => {
    await request(ctx.app)
      .post('/api/platform/outlets')
      .set('Authorization', platformAuth())
      .send({ tenantId: TENANT_ID, name: 'Cabang Kuta', address: 'Jl. Raya Kuta No. 1', phone: '08123456789' });

    const outlets = await ctx.outletRepo.findByTenant(TENANT_ID);
    const outletId = outlets[0].serialize().id;

    const res = await request(ctx.app)
      .put(`/api/platform/outlets/${outletId}`)
      .set('Authorization', platformAuth())
      .send({ tenantId: TENANT_ID, name: 'Cabang Kuta Renovated', address: 'Jl. Raya Kuta No. 2', phone: '089999', isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Cabang Kuta Renovated');
    expect(res.body.data.isActive).toBe(false);

    const updated = await ctx.outletRepo.findById(outletId);
    expect(updated?.serialize().name).toBe('Cabang Kuta Renovated');
    expect(updated?.serialize().address).toBe('Jl. Raya Kuta No. 2');
  });

  it('requires tenantId in body', async () => {
    const res = await request(ctx.app)
      .put('/api/platform/outlets/whatever')
      .set('Authorization', platformAuth())
      .send({ name: 'X' });

    expect(res.status).toBe(400);
  });
});

describe('Platform Outlet Hard Delete (DELETE /api/platform/outlets/:outletId)', () => {
  it('hard-deletes outlet + linked warehouse + pulls outletId from users', async () => {
    await request(ctx.app)
      .post('/api/platform/outlets')
      .set('Authorization', platformAuth())
      .send({ tenantId: TENANT_ID, name: 'Cabang Kuta', address: 'Jl. Raya Kuta No. 1', phone: '08123456789' });

    const outlets = await ctx.outletRepo.findByTenant(TENANT_ID);
    const outletId = outlets[0].serialize().id;
    const warehouseId = outlets[0].serialize().warehouseId!;

    await seedUser(ctx.userRepo, TENANT_ID, outletId);

    const res = await request(ctx.app)
      .delete(`/api/platform/outlets/${outletId}`)
      .set('Authorization', platformAuth())
      .send({ tenantId: TENANT_ID, reason: 'cabang tutup' });

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(res.body.data.warehouseDeleted).toBe(1);
    expect(res.body.data.usersUpdated).toBeGreaterThanOrEqual(1);

    const outletAfter = await ctx.outletRepo.findById(outletId);
    expect(outletAfter).toBeNull();
    const warehouseAfter = await ctx.warehouseRepo.findById(warehouseId);
    expect(warehouseAfter).toBeNull();

    const userDoc = await mongoose.connection.collection('users').findOne({ _id: `user-${TENANT_ID}` });
    expect(userDoc.outletIds).not.toContain(outletId);

    const auditDoc = await mongoose.connection.collection('platform_audit_logs').findOne({ tenantId: TENANT_ID, action: 'OUTLET_DELETED' });
    expect(auditDoc).not.toBeNull();
  });
});

describe('RBAC on tenant/outlet mutation routes', () => {
  it('tenant session is rejected (401)', async () => {
    const put = await request(ctx.app)
      .put(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', tenantAuth())
      .send({ name: 'X' });
    expect(put.status).toBe(401);

    const del = await request(ctx.app)
      .delete(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', tenantAuth());
    expect(del.status).toBe(401);
  });

  it('platform viewer without manage perms is rejected (403)', async () => {
    const res = await request(ctx.app)
      .delete(`/api/platform/tenants/${TENANT_ID}`)
      .set('Authorization', `Bearer ${ctx.platformTokenNoOutletManage}`);
    expect(res.status).toBe(403);
  });

  it('reads still work for platform readers', async () => {
    const res = await request(ctx.app)
      .get('/api/platform/tenants')
      .set('Authorization', `Bearer ${ctx.platformTokenNoOutletManage}`);
    expect(res.status).toBe(200);
  });
});