import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { PERMISSIONS } from '@posmono/shared';
import { migrateTenantBillingRead } from '../../src/core/platform/infrastructure/persistence/migrateTenantBillingRead';
import { migrateTenantBillingUpdate } from '../../src/core/platform/infrastructure/persistence/migrateTenantBillingUpdate';
import { RoleSchema } from '../../src/core/identity/infrastructure/persistence/schemas/RoleSchema';
import {
  OWNER_PERMS,
  MANAGER_PERMS,
  CASHIER_PERMS,
  HUB_MEMBER_ROLE_PERMS,
  TENANT_ACCESS_ROLE_PERMS,
} from '../../src/core/platform/defaults/roles';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

let model: Model<any>;

function createRole(tenantId: string, name: string, permissions: string[]) {
  return model.create({ _id: `rol-${tenantId}-${name}`, tenantId, name, permissions, isSystem: true });
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('Role', RoleSchema);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('Member Area Langganan — RBAC & migration', () => {
  it('bundles settings.billing.read in OWNER_PERMS and MANAGER_PERMS, but not CASHIER_PERMS', () => {
    expect(OWNER_PERMS).toContain(PERMISSIONS.SETTINGS_BILLING_READ);
    expect(MANAGER_PERMS).toContain(PERMISSIONS.SETTINGS_BILLING_READ);
    expect(CASHIER_PERMS).not.toContain(PERMISSIONS.SETTINGS_BILLING_READ);

    expect(HUB_MEMBER_ROLE_PERMS.owner).toContain(PERMISSIONS.SETTINGS_BILLING_READ);
    expect(HUB_MEMBER_ROLE_PERMS.manager).toContain(PERMISSIONS.SETTINGS_BILLING_READ);
    expect(HUB_MEMBER_ROLE_PERMS.viewer).not.toContain(PERMISSIONS.SETTINGS_BILLING_READ);

    expect(TENANT_ACCESS_ROLE_PERMS.owner).toContain(PERMISSIONS.SETTINGS_BILLING_READ);
    expect(TENANT_ACCESS_ROLE_PERMS.manager).toContain(PERMISSIONS.SETTINGS_BILLING_READ);
    expect(TENANT_ACCESS_ROLE_PERMS.cashier).not.toContain(PERMISSIONS.SETTINGS_BILLING_READ);
  });

  it('migrates stored Owner and Manager roles without settings.billing.read idempotently', async () => {
    await createRole('t1', 'Owner', ['users:read', 'orders:read']);
    await createRole('t1', 'Manager', ['products:read']);
    await createRole('t1', 'Cashier', ['orders:read']);
    await createRole('t2', 'Owner', ['users:read', PERMISSIONS.SETTINGS_BILLING_READ]);

    const firstRun = await migrateTenantBillingRead(model);
    expect(firstRun.matched).toBe(2);
    expect(firstRun.modified).toBe(2);

    const ownerT1 = await model.findById('rol-t1-Owner').lean();
    expect(ownerT1.permissions).toContain(PERMISSIONS.SETTINGS_BILLING_READ);
    expect(ownerT1.permissions).toContain('users:read');

    const managerT1 = await model.findById('rol-t1-Manager').lean();
    expect(managerT1.permissions).toContain(PERMISSIONS.SETTINGS_BILLING_READ);

    const cashierT1 = await model.findById('rol-t1-Cashier').lean();
    expect(cashierT1.permissions).not.toContain(PERMISSIONS.SETTINGS_BILLING_READ);

    // Second run is idempotent
    const secondRun = await migrateTenantBillingRead(model);
    expect(secondRun.matched).toBe(0);
    expect(secondRun.modified).toBe(0);
  });

  it('bundles settings.billing.update in OWNER_PERMS only (Manager is read-only)', () => {
    expect(OWNER_PERMS).toContain(PERMISSIONS.SETTINGS_BILLING_UPDATE);
    expect(MANAGER_PERMS).not.toContain(PERMISSIONS.SETTINGS_BILLING_UPDATE);
    expect(CASHIER_PERMS).not.toContain(PERMISSIONS.SETTINGS_BILLING_UPDATE);
  });

  it('migrates stored Owner roles with settings.billing.update idempotently, never Manager', async () => {
    await createRole('t1', 'Owner', ['users:read']);
    await createRole('t1', 'Manager', ['products:read']);
    await createRole('t1', 'Cashier', ['orders:read']);
    await createRole('t2', 'Owner', ['users:read', PERMISSIONS.SETTINGS_BILLING_UPDATE]);

    const firstRun = await migrateTenantBillingUpdate(model);
    expect(firstRun.matched).toBe(1);
    expect(firstRun.modified).toBe(1);

    const ownerT1 = await model.findById('rol-t1-Owner').lean();
    expect(ownerT1.permissions).toContain(PERMISSIONS.SETTINGS_BILLING_UPDATE);
    expect(ownerT1.permissions).toContain('users:read');

    const managerT1 = await model.findById('rol-t1-Manager').lean();
    expect(managerT1.permissions).not.toContain(PERMISSIONS.SETTINGS_BILLING_UPDATE);

    const cashierT1 = await model.findById('rol-t1-Cashier').lean();
    expect(cashierT1.permissions).not.toContain(PERMISSIONS.SETTINGS_BILLING_UPDATE);

    // Second run is idempotent ($addToSet + $ne guard)
    const secondRun = await migrateTenantBillingUpdate(model);
    expect(secondRun.matched).toBe(0);
    expect(secondRun.modified).toBe(0);
  });
});
