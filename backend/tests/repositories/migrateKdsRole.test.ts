import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { PERMISSIONS } from '@posmono/shared';
import { migrateKdsRole } from '../../src/core/platform/infrastructure/persistence/migrateKdsRole';
import { KDS_PERMS, KDS_ROLE_NAME, OWNER_PERMS, CASHIER_PERMS } from '../../src/core/platform/defaults/roles';
import { RoleSchema } from '../../src/core/identity/infrastructure/persistence/schemas/RoleSchema';
import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

let RoleModel: Model<any>;
let TenantModel: Model<any>;

async function createTenant(id: string) {
  await mongoose.connection.db!.collection('tenants').insertOne({
    _id: id,
    name: id,
    slug: id,
    ownerId: 'u1',
    plan: 'pro',
    status: 'active',
    businessType: 'retail',
    modules: ['core'],
    databaseName: id,
    billingEmail: `${id}@example.test`,
  } as never);
}

beforeAll(async () => {
  await setupTestDb();
  RoleModel = mongoose.model('Role', RoleSchema);
  TenantModel = mongoose.model('Tenant', TenantSchema);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('KDS role defaults and migration', () => {
  it('keeps the display role free of POS, payment, report, and billing permissions', () => {
    expect(KDS_PERMS).toEqual([PERMISSIONS.KDS_READ, PERMISSIONS.KDS_WRITE]);
    expect(KDS_PERMS).not.toContain('settings.billing.read');
    expect(KDS_PERMS).not.toContain('orders:read');
    expect(KDS_PERMS).not.toContain('printers:write');
    expect(OWNER_PERMS).toEqual(expect.arrayContaining(KDS_PERMS));
    expect(CASHIER_PERMS).not.toContain(PERMISSIONS.KDS_READ);
  });

  it('creates the KDS role per tenant and adds the permissions to Owner/Manager only', async () => {
    await createTenant('t1');
    await createTenant('t2');
    await RoleModel.create({ _id: 'rol-1', tenantId: 't1', name: 'Owner', permissions: ['users:read'], isSystem: true });
    await RoleModel.create({ _id: 'rol-2', tenantId: 't1', name: 'Manager', permissions: ['products:read'], isSystem: true });
    await RoleModel.create({ _id: 'rol-3', tenantId: 't1', name: 'Cashier', permissions: ['orders:read'], isSystem: true });

    const first = await migrateKdsRole(RoleModel, TenantModel);
    expect(first.created).toBe(2);

    const kds = await RoleModel.findOne({ tenantId: 't1', name: KDS_ROLE_NAME }).lean();
    expect(kds?.permissions).toEqual(KDS_PERMS);
    expect(kds?.isSystem).toBe(true);

    const owner = await RoleModel.findById('rol-1').lean();
    expect(owner?.permissions).toEqual(expect.arrayContaining(KDS_PERMS));
    expect(owner?.permissions).toContain('users:read');

    const manager = await RoleModel.findById('rol-2').lean();
    expect(manager?.permissions).toEqual(expect.arrayContaining(KDS_PERMS));

    const cashier = await RoleModel.findById('rol-3').lean();
    expect(cashier?.permissions).not.toContain(PERMISSIONS.KDS_READ);

    const second = await migrateKdsRole(RoleModel, TenantModel);
    expect(second.created).toBe(0);
    expect(second.modified).toBe(0);
  });
});
