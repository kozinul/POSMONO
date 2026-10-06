import { describe, it, expect } from 'vitest';
import {
  assignableHubRoles,
  canManageHubMember,
  hubRoleStrength,
} from '../../src/core/hub/utils/roles';

/**
 * Regression guard for the inversion trap: `HUB_MEMBER_ROLES` is ordered
 * widest-first, so `indexOf` ranks `owner` lowest. Comparing with `>` on that
 * ordering made an owner unable to manage a viewer — the UI silently inverting
 * the rule the API enforces. These tests exist to make that impossible to
 * reintroduce unnoticed.
 */
describe('hub role strength', () => {
  it('owner ranks above admin, manager and viewer', () => {
    expect(hubRoleStrength('owner')).toBeGreaterThan(hubRoleStrength('admin'));
    expect(hubRoleStrength('admin')).toBeGreaterThan(hubRoleStrength('manager'));
    expect(hubRoleStrength('manager')).toBeGreaterThan(hubRoleStrength('viewer'));
  });

  it('unknown role ranks below every real role', () => {
    expect(hubRoleStrength('superuser')).toBeLessThan(hubRoleStrength('viewer'));
  });

  describe('canManageHubMember', () => {
    const member = { userId: 'u-2', role: 'viewer' };

    it('owner may manage a viewer', () => {
      expect(canManageHubMember('owner', member, 'u-1')).toBe(true);
    });

    it('admin may manage a manager but not a peer admin', () => {
      expect(canManageHubMember('admin', { userId: 'u-3', role: 'manager' }, 'u-1')).toBe(true);
      expect(canManageHubMember('admin', { userId: 'u-4', role: 'admin' }, 'u-1')).toBe(false);
    });

    it('nobody may manage themselves', () => {
      expect(canManageHubMember('owner', { userId: 'u-1', role: 'owner' }, 'u-1')).toBe(false);
      expect(canManageHubMember('owner', member, 'u-2')).toBe(false);
    });

    it('owner is not manageable by any other role', () => {
      for (const role of ['owner', 'admin', 'manager', 'viewer']) {
        expect(canManageHubMember(role, { userId: 'u-9', role: 'owner' }, 'u-1')).toBe(false);
      }
    });

    it('viewer may manage nobody', () => {
      expect(canManageHubMember('viewer', { userId: 'u-5', role: 'viewer' }, 'u-1')).toBe(false);
    });

    it('is inert without a signed-in id', () => {
      expect(canManageHubMember('owner', member, '')).toBe(false);
    });
  });

  describe('assignableHubRoles', () => {
    it('owner may hand out every role', () => {
      expect(assignableHubRoles('owner')).toEqual(['owner', 'admin', 'manager', 'viewer']);
    });

    it('admin cannot hand out owner', () => {
      expect(assignableHubRoles('admin')).toEqual(['admin', 'manager', 'viewer']);
    });

    it('viewer may only hand out viewer', () => {
      expect(assignableHubRoles('viewer')).toEqual(['viewer']);
    });
  });
});
