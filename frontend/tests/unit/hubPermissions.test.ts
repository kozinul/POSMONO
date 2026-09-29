import { describe, it, expect } from 'vitest';
import { PERMISSIONS } from '@posmono/shared';
import {
  HUB_MEMBER_ROLES,
  HUB_MEMBER_ROLE_LABELS,
  HUB_MEMBER_ROLE_HINTS,
  type HubMemberRole,
} from '../../src/@shared/hooks/useHubMemberships';

describe('Hub V2 Fase 16 — frontend permission & role contract', () => {
  it('uses the renamed platform hub permission and no longer exposes hub:manage', () => {
    expect(PERMISSIONS.PLATFORM_HUBS_MANAGE).toBe('platform.hubs.manage');
    expect(PERMISSIONS).not.toHaveProperty('HUB_MANAGE');
  });

  it('offers all four hub member roles with a label and a hint', () => {
    expect(HUB_MEMBER_ROLES).toEqual(['owner', 'admin', 'manager', 'viewer']);

    for (const role of HUB_MEMBER_ROLES) {
      expect(HUB_MEMBER_ROLE_LABELS[role]).toBeTruthy();
      expect(HUB_MEMBER_ROLE_HINTS[role]).toBeTruthy();
    }
  });

  it('keeps the reserved hub.* namespace out of the platform permission set', () => {
    const reserved = [
      PERMISSIONS.HUB_READ,
      PERMISSIONS.HUB_MEMBERS_READ,
      PERMISSIONS.HUB_MEMBERS_MANAGE,
      PERMISSIONS.HUB_TENANTS_READ,
      PERMISSIONS.HUB_TENANTS_MANAGE,
      PERMISSIONS.HUB_REPORTS_READ,
      PERMISSIONS.HUB_REPORTS_EXPORT,
    ];

    for (const permission of reserved) {
      expect(permission).toMatch(/^hub\./);
    }
  });

  it('types the role union as the four hub roles', () => {
    const exhaustive: Record<HubMemberRole, true> = {
      owner: true,
      admin: true,
      manager: true,
      viewer: true,
    };
    expect(Object.keys(exhaustive)).toEqual(HUB_MEMBER_ROLES);
  });
});
