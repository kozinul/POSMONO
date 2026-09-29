import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { PERMISSIONS } from '@posmono/shared';
import {
  migratePlatformHubPermissions,
  LEGACY_PLATFORM_HUB_PERMISSION,
} from '../../src/core/platform/infrastructure/persistence/migratePlatformHubPermissions';
import { RoleSchema } from '../../src/core/identity/infrastructure/persistence/schemas/RoleSchema';
import {
  PLATFORM_ROLE_PERMS,
  HUB_MEMBER_ROLE_PERMS,
  HUB_MEMBER_ROLE_LABELS,
  HUB_ROLE_PERMISSION_MATRIX,
  DEFAULT_PLATFORM_ROLE,
} from '../../src/core/platform/defaults/roles';
import { HUB_MEMBER_ROLES } from '../../src/core/hub/domain/HubMembership';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const PLATFORM_TENANT_ID = 'platform';

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

describe('Hub V2 Fase 16 — permission namespace', () => {
  it('does not leak the legacy hub:manage into the platform role', () => {
    expect(PLATFORM_ROLE_PERMS).not.toContain(LEGACY_PLATFORM_HUB_PERMISSION);
    expect(PLATFORM_ROLE_PERMS).toContain(PERMISSIONS.PLATFORM_HUBS_MANAGE);
    expect(DEFAULT_PLATFORM_ROLE.permissions).toEqual(PLATFORM_ROLE_PERMS);
  });

  it('defines the reserved hub.* namespace without the old colon-style hub permission', () => {
    const reserved = [
      PERMISSIONS.HUB_READ,
      PERMISSIONS.HUB_MEMBERS_READ,
      PERMISSIONS.HUB_MEMBERS_MANAGE,
      PERMISSIONS.HUB_TENANTS_READ,
      PERMISSIONS.HUB_TENANTS_MANAGE,
      PERMISSIONS.HUB_REPORTS_READ,
      PERMISSIONS.HUB_REPORTS_EXPORT,
    ];

    expect(new Set(reserved).size).toBe(reserved.length);
    for (const permission of reserved) {
      expect(permission.startsWith('hub.')).toBe(true);
      expect(PERMISSIONS).not.toHaveProperty('HUB_MANAGE');
    }
  });

  it('covers all four hub roles in both matrices', () => {
    expect([...HUB_MEMBER_ROLES]).toEqual(['owner', 'admin', 'manager', 'viewer']);

    for (const role of HUB_MEMBER_ROLES) {
      expect(HUB_MEMBER_ROLE_PERMS[role]?.length ?? 0).toBeGreaterThan(0);
      expect(HUB_MEMBER_ROLE_LABELS[role]).toBeTruthy();
      expect(HUB_ROLE_PERMISSION_MATRIX[role]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('keeps the reserved matrix monotonic: manager cannot manage members', () => {
    const matrix = HUB_ROLE_PERMISSION_MATRIX;

    expect(matrix.owner).toContain(PERMISSIONS.HUB_MEMBERS_MANAGE);
    expect(matrix.owner).toContain(PERMISSIONS.HUB_TENANTS_MANAGE);
    expect(matrix.admin).toContain(PERMISSIONS.HUB_MEMBERS_MANAGE);
    expect(matrix.admin).not.toContain(PERMISSIONS.HUB_TENANTS_MANAGE);
    expect(matrix.manager).not.toContain(PERMISSIONS.HUB_MEMBERS_MANAGE);
    expect(matrix.manager).not.toContain(PERMISSIONS.HUB_REPORTS_EXPORT);
    expect(matrix.viewer).toEqual([PERMISSIONS.HUB_READ, PERMISSIONS.HUB_REPORTS_READ]);
  });

  it('gives hub manager tenant operations but not user management', () => {
    const manager = HUB_MEMBER_ROLE_PERMS.manager;

    expect(manager).toContain('products:write');
    expect(manager).toContain('orders:write');
    expect(manager).not.toContain('users:write');
    expect(HUB_MEMBER_ROLE_PERMS.admin).toContain('users:read');
    expect(HUB_MEMBER_ROLE_PERMS.owner.length).toBeGreaterThan(manager.length);
  });
});

describe('migratePlatformHubPermissions', () => {
  it('renames the legacy permission in the platform role', async () => {
    await createRole(PLATFORM_TENANT_ID, 'Platform Super Admin', [
      LEGACY_PLATFORM_HUB_PERMISSION,
      'platform.tenants.read',
    ]);

    const result = await migratePlatformHubPermissions(model);
    expect(result).toEqual({ matched: 1, modified: 1 });

    const role = await model.findOne({ tenantId: PLATFORM_TENANT_ID }).lean();
    expect(role.permissions).toContain(PERMISSIONS.PLATFORM_HUBS_MANAGE);
    expect(role.permissions).not.toContain(LEGACY_PLATFORM_HUB_PERMISSION);
    expect(role.permissions).toContain('platform.tenants.read');
  });

  it('migrates custom roles that still hold the legacy string and keeps other tenants intact', async () => {
    await createRole(PLATFORM_TENANT_ID, 'Platform Super Admin', [LEGACY_PLATFORM_HUB_PERMISSION]);
    await createRole(PLATFORM_TENANT_ID, 'Platform Support', [LEGACY_PLATFORM_HUB_PERMISSION, 'platform.support.access']);
    await createRole('tenant-a', 'Owner', ['products:read', LEGACY_PLATFORM_HUB_PERMISSION]);

    await migratePlatformHubPermissions(model);

    const support = await model.findOne({ tenantId: PLATFORM_TENANT_ID, name: 'Platform Support' }).lean();
    expect(support.permissions).toContain(PERMISSIONS.PLATFORM_HUBS_MANAGE);
    expect(support.permissions).toContain('platform.support.access');

    const tenantRole = await model.findOne({ tenantId: 'tenant-a' }).lean();
    expect(tenantRole.permissions).toContain(PERMISSIONS.PLATFORM_HUBS_MANAGE);
    expect(tenantRole.permissions).toContain('products:read');
  });

  it('is idempotent — a second run changes nothing', async () => {
    await createRole(PLATFORM_TENANT_ID, 'Platform Super Admin', [LEGACY_PLATFORM_HUB_PERMISSION]);

    await migratePlatformHubPermissions(model);
    const second = await migratePlatformHubPermissions(model);

    expect(second).toEqual({ matched: 0, modified: 0 });

    const role = await model.findOne({ tenantId: PLATFORM_TENANT_ID }).lean();
    expect(role.permissions).toEqual([PERMISSIONS.PLATFORM_HUBS_MANAGE]);
  });

  it('does not duplicate the permission when both strings are already present', async () => {
    await createRole(PLATFORM_TENANT_ID, 'Platform Super Admin', [
      LEGACY_PLATFORM_HUB_PERMISSION,
      PERMISSIONS.PLATFORM_HUBS_MANAGE,
    ]);

    await migratePlatformHubPermissions(model);

    const role = await model.findOne({ tenantId: PLATFORM_TENANT_ID }).lean();
    expect(role.permissions).toEqual([PERMISSIONS.PLATFORM_HUBS_MANAGE]);
  });

  it('leaves roles without the legacy permission untouched', async () => {
    await createRole('tenant-a', 'Owner', ['products:read', 'orders:read']);

    const result = await migratePlatformHubPermissions(model);
    expect(result).toEqual({ matched: 0, modified: 0 });

    const role = await model.findOne({ tenantId: 'tenant-a' }).lean();
    expect(role.permissions).toEqual(['products:read', 'orders:read']);
  });
});
