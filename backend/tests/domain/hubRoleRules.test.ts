import { describe, it, expect } from 'vitest';
import {
  assertMayAssignHubRole,
  assertMayManageMember,
  assertNotSelf,
  assertTenantRoleWithinActor,
  HUB_ROLE_MAX_TENANT_GRANT,
  HUB_ROLE_RANK,
} from '../../src/core/hub/domain/hubRoleRules';

const owner = { userId: 'owner', role: 'owner' as const };
const admin = { userId: 'admin', role: 'admin' as const };
const manager = { userId: 'manager', role: 'manager' as const };
const viewer = { userId: 'viewer', role: 'viewer' as const };

describe('hubRoleRules', () => {
  describe('HUB_ROLE_RANK', () => {
    it('orders the four roles strictly', () => {
      expect(HUB_ROLE_RANK.owner).toBeGreaterThan(HUB_ROLE_RANK.admin);
      expect(HUB_ROLE_RANK.admin).toBeGreaterThan(HUB_ROLE_RANK.manager);
      expect(HUB_ROLE_RANK.manager).toBeGreaterThan(HUB_ROLE_RANK.viewer);
    });
  });

  describe('assertNotSelf', () => {
    it('denies self-service, even for an owner', () => {
      expect(() => assertNotSelf(owner, 'owner', 'menghapus')).toThrow(/akun Anda sendiri/);
      expect(() => assertNotSelf(admin, 'admin', 'mengubah role')).toThrow(/akun Anda sendiri/);
    });

    it('allows the action on somebody else', () => {
      expect(() => assertNotSelf(admin, 'manager', 'mengubah role')).not.toThrow();
    });
  });

  describe('assertMayManageMember', () => {
    it('lets an admin manage a manager or a viewer', () => {
      expect(() => assertMayManageMember(admin, { userId: 'm', role: 'manager' }, 'menangguhkan')).not.toThrow();
      expect(() => assertMayManageMember(admin, { userId: 'v', role: 'viewer' }, 'menghapus')).not.toThrow();
    });

    it('lets an owner manage anybody below owner', () => {
      expect(() => assertMayManageMember(owner, { userId: 'a', role: 'admin' }, 'menghapus')).not.toThrow();
      expect(() => assertMayManageMember(owner, { userId: 'a2', role: 'admin' }, 'mengubah role')).not.toThrow();
    });

    it('denies peers, so two admins cannot cancel each other out', () => {
      expect(() => assertMayManageMember(admin, { userId: 'a2', role: 'admin' }, 'menangguhkan')).toThrow(
        /tidak bisa menangguhkan/,
      );
      expect(() => assertMayManageMember(viewer, { userId: 'v2', role: 'viewer' }, 'menghapus')).toThrow(
        /tidak bisa menghapus/,
      );
    });

    it('denies managing anyone above the actor', () => {
      expect(() => assertMayManageMember(admin, { userId: 'o', role: 'owner' }, 'mengubah role')).toThrow(
        /owner atau lebih tinggi/,
      );
      expect(() => assertMayManageMember(manager, { userId: 'a', role: 'admin' }, 'menghapus')).toThrow(
        /admin atau lebih tinggi/,
      );
    });

    it('leaves an owner row immutable from this surface', () => {
      // Nothing ranks above `owner`, so no member can demote, suspend or remove
      // one — which is what guarantees the hub stays administrable. See the
      // doc comment on `assertMayManageMember`.
      expect(() => assertMayManageMember(owner, { userId: 'o', role: 'owner' }, 'menghapus')).toThrow(
        /owner atau lebih tinggi/,
      );
    });

    it('combines with assertNotSelf — a peer targeting itself is denied too', () => {
      expect(() => assertMayManageMember(admin, { userId: 'admin', role: 'admin' }, 'menangguhkan')).toThrow(
        /akun Anda sendiri/,
      );
    });
  });

  describe('assertMayAssignHubRole', () => {
    it('allows assigning at or below the actor rank', () => {
      expect(() => assertMayAssignHubRole(owner, 'owner')).not.toThrow();
      expect(() => assertMayAssignHubRole(owner, 'admin')).not.toThrow();
      expect(() => assertMayAssignHubRole(admin, 'admin')).not.toThrow();
      expect(() => assertMayAssignHubRole(manager, 'viewer')).not.toThrow();
    });

    it('denies handing out a rank above the actor', () => {
      expect(() => assertMayAssignHubRole(admin, 'owner')).toThrow(/tidak bisa memberikan role owner/);
      expect(() => assertMayAssignHubRole(manager, 'admin')).toThrow(/tidak bisa memberikan role admin/);
      expect(() => assertMayAssignHubRole(viewer, 'manager')).toThrow(/tidak bisa memberikan role manager/);
    });
  });

  describe('HUB_ROLE_MAX_TENANT_GRANT', () => {
    it('caps each hub role, and gives a viewer nothing at all', () => {
      expect(HUB_ROLE_MAX_TENANT_GRANT.owner).toBe('owner');
      expect(HUB_ROLE_MAX_TENANT_GRANT.admin).toBe('admin');
      expect(HUB_ROLE_MAX_TENANT_GRANT.manager).toBe('manager');
      expect(HUB_ROLE_MAX_TENANT_GRANT.viewer).toBeNull();
    });
  });

  describe('assertTenantRoleWithinActor', () => {
    it('allows a grant at or below the actor ceiling', () => {
      expect(() => assertTenantRoleWithinActor(owner, 'owner')).not.toThrow();
      expect(() => assertTenantRoleWithinActor(owner, 'cashier')).not.toThrow();
      expect(() => assertTenantRoleWithinActor(admin, 'admin')).not.toThrow();
      expect(() => assertTenantRoleWithinActor(manager, 'manager')).not.toThrow();
      expect(() => assertTenantRoleWithinActor(manager, 'cashier')).not.toThrow();
    });

    it('denies a grant worth more than the issuing account', () => {
      expect(() => assertTenantRoleWithinActor(manager, 'owner')).toThrow(/sampai role manager/);
      expect(() => assertTenantRoleWithinActor(manager, 'admin')).toThrow(/sampai role manager/);
      expect(() => assertTenantRoleWithinActor(admin, 'owner')).toThrow(/sampai role admin/);
    });

    it('denies a viewer any grant at all, even the smallest one', () => {
      // A hub `viewer` can only read a hub. Granting tenant `cashier` would hand
      // it sales authority over a branch it is supposed to merely look at.
      expect(() => assertTenantRoleWithinActor(viewer, 'viewer')).toThrow(/tidak bisa memberikan akses tenant/);
      expect(() => assertTenantRoleWithinActor(viewer, 'cashier')).toThrow(/tidak bisa memberikan akses tenant/);
    });

    it('rejects an unknown tenant role before comparing', () => {
      expect(() => assertTenantRoleWithinActor(owner, 'superuser' as any)).toThrow(/tenantRole tidak valid/);
    });
  });
});
