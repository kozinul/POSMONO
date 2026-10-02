import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { makeHub, type HubStatus } from '../fixtures/hub.fixtures';
import { ConflictError, NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';

const HUB_ID = 'hub-1';
const USER_A = 'user-a';
const USER_B = 'user-b';
const USER_C = 'user-c';

function createHub(id: string, name = 'BCA Hospitality', status: HubStatus = 'active') {
  return makeHub({ id, name, code: name.toUpperCase().replace(/\W+/g, '-'), status });
}

function createMembership(hubId: string, userId: string, role: string, id = `m-${userId}`) {
  return HubMembership.hydrate({
    id,
    hubId,
    userId,
    role: role as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
}

function createTenant(id: string, name: string, hubId: string = HUB_ID) {
  return { serialize: () => ({ id, name, hubId }) };
}

function createMockRepos() {
  const hubMembershipRepository = {
    save: vi.fn(),
    findById: vi.fn(),
    findByHubAndUser: vi.fn(),
    findByHub: vi.fn(),
    findByUser: vi.fn(),
    deleteByHubAndUser: vi.fn(async () => true),
  };
  const hubRepository = {
    save: vi.fn(),
    findById: vi.fn(async () => createHub(HUB_ID)),
    findByName: vi.fn(),
    findByCode: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };
  const tenantRepository = {
    findById: vi.fn(),
    findByHubId: vi.fn(),
  };
  const userRepository = {
    findByIdRaw: vi.fn(),
  };
  return { hubMembershipRepository, hubRepository, tenantRepository, userRepository };
}

describe('HubMembershipService', () => {
  let repos: ReturnType<typeof createMockRepos>;
  let service: HubMembershipService;
  let accessService: {
    syncDefaultGrantsForMember: ReturnType<typeof vi.fn>;
    suspendAllGrantsForMember: ReturnType<typeof vi.fn>;
    findAccessibleTenants: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repos = createMockRepos();
    accessService = {
      syncDefaultGrantsForMember: vi.fn(async () => 0),
      suspendAllGrantsForMember: vi.fn(async () => 0),
      findAccessibleTenants: vi.fn(async () => []),
    };
    service = new HubMembershipService(repos as any);
  });

  describe('Fase 17 access-grant coupling', () => {
    it('seeds the D3 viewer baseline when a member is added', async () => {
      service = new HubMembershipService({ ...repos, accessService } as any);
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.userRepository.findByIdRaw.mockResolvedValue({ id: USER_A });
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);

      await service.addMembership(HUB_ID, USER_A, 'owner');

      // hub role `owner` must not become Owner in every tenant of the hub
      expect(accessService.syncDefaultGrantsForMember).toHaveBeenCalledWith(HUB_ID, USER_A);
    });

    it('keeps the membership when the baseline seeding fails', async () => {
      service = new HubMembershipService({ ...repos, accessService } as any);
      accessService.syncDefaultGrantsForMember.mockRejectedValueOnce(new Error('grant db down'));
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.userRepository.findByIdRaw.mockResolvedValue({ id: USER_A });
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);

      const membership = await service.addMembership(HUB_ID, USER_A, 'viewer');
      expect(membership.serialize().userId).toBe(USER_A);
    });

    it('suspends the member grants on removal so they cannot outlive the membership', async () => {
      service = new HubMembershipService({ ...repos, accessService } as any);
      repos.hubMembershipRepository.deleteByHubAndUser.mockResolvedValue(true);

      await service.removeMembership(HUB_ID, USER_A);

      expect(accessService.suspendAllGrantsForMember).toHaveBeenCalledWith(HUB_ID, USER_A);
    });

    it('does not suspend grants when the removal itself failed', async () => {
      service = new HubMembershipService({ ...repos, accessService } as any);
      repos.hubMembershipRepository.deleteByHubAndUser.mockResolvedValue(false);

      await expect(service.removeMembership(HUB_ID, USER_A)).rejects.toThrow(NotFoundError);
      expect(accessService.suspendAllGrantsForMember).not.toHaveBeenCalled();
    });

    it('still works when the access service is not wired', async () => {
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.userRepository.findByIdRaw.mockResolvedValue({ id: USER_A });
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);

      const membership = await service.addMembership(HUB_ID, USER_A, 'owner');
      expect(membership.serialize().role).toBe('owner');
    });

    it('delegates findAccessibleTenants to the access service when present', async () => {
      service = new HubMembershipService({ ...repos, accessService } as any);
      const rows = [{ tenantId: 'tenant-a', role: 'owner' }];
      accessService.findAccessibleTenants.mockResolvedValue(rows);

      expect(await service.findAccessibleTenants(USER_A)).toBe(rows);
    });
  });

  describe('addMembership', () => {
    it('creates a membership for an existing hub + user', async () => {
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.userRepository.findByIdRaw.mockResolvedValue({ id: USER_A, displayNameValue: 'A' });
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);

      const membership = await service.addMembership(HUB_ID, USER_A, 'admin');

      expect(membership.serialize().hubId).toBe(HUB_ID);
      expect(membership.serialize().role).toBe('admin');
      expect(repos.hubMembershipRepository.save).toHaveBeenCalledOnce();
    });

    it('rejects invalid roles', async () => {
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.userRepository.findByIdRaw.mockResolvedValue({});
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);

      await expect(service.addMembership(HUB_ID, USER_A, 'superuser' as any)).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError when hub is missing', async () => {
      repos.hubRepository.findById.mockResolvedValue(null);

      await expect(service.addMembership('missing-hub', USER_A, 'viewer')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when user is missing', async () => {
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.userRepository.findByIdRaw.mockResolvedValue(null);

      await expect(service.addMembership(HUB_ID, USER_A, 'viewer')).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError on duplicate hub+user', async () => {
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.userRepository.findByIdRaw.mockResolvedValue({ id: USER_A });
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(createMembership(HUB_ID, USER_A, 'admin'));

      await expect(service.addMembership(HUB_ID, USER_A, 'admin')).rejects.toThrow(ConflictError);
    });
  });

  describe('removeMembership', () => {
    it('deletes the membership', async () => {
      await service.removeMembership(HUB_ID, USER_A);
      expect(repos.hubMembershipRepository.deleteByHubAndUser).toHaveBeenCalledWith(HUB_ID, USER_A);
    });

    it('throws NotFoundError when nothing deleted', async () => {
      repos.hubMembershipRepository.deleteByHubAndUser.mockResolvedValue(false);
      await expect(service.removeMembership(HUB_ID, USER_A)).rejects.toThrow(NotFoundError);
    });
  });

  describe('listMembers', () => {
    it('decorates members with user info best-effort', async () => {
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.hubMembershipRepository.findByHub.mockResolvedValue([
        createMembership(HUB_ID, USER_A, 'owner'),
        createMembership(HUB_ID, USER_B, 'viewer', 'm-2'),
      ]);
      repos.userRepository.findByIdRaw.mockImplementation(async (id: string) =>
        id === USER_A ? { displayNameValue: 'Alice Admin', emailValue: 'a@x.com', serialize: () => ({ tenantId: 'tenant-a' }) } : null,
      );

      const members = await service.listMembers(HUB_ID);

      expect(members).toHaveLength(2);
      expect(members[0].role).toBe('owner');
      expect(members[0].displayName).toBe('Alice Admin');
      expect(members[0].email).toBe('a@x.com');
      expect(members[1].displayName).toBeNull();
    });

    it('decorates members with their home tenant name, one lookup per distinct tenant', async () => {
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.hubMembershipRepository.findByHub.mockResolvedValue([
        createMembership(HUB_ID, USER_A, 'owner'),
        createMembership(HUB_ID, USER_B, 'admin', 'm-2'),
        createMembership(HUB_ID, USER_C, 'viewer', 'm-3'),
      ]);
      repos.userRepository.findByIdRaw.mockImplementation(async (id: string) => {
        if (id === USER_A) return { serialize: () => ({ displayName: 'A', email: 'a@x.com', tenantId: 'tenant-a' }) };
        if (id === USER_B) return { serialize: () => ({ displayName: 'B', email: 'b@x.com', tenantId: 'tenant-a' }) };
        return { serialize: () => ({ displayName: 'C', email: 'c@x.com', tenantId: 'tenant-b' }) };
      });
      repos.tenantRepository.findById.mockImplementation(async (id: string) =>
        id === 'tenant-a' ? createTenant('tenant-a', 'Alpha Kopi') : createTenant('tenant-b', 'Beta Resto'),
      );

      const members = await service.listMembers(HUB_ID);

      expect(members.map((m) => m.userTenantName)).toEqual(['Alpha Kopi', 'Alpha Kopi', 'Beta Resto']);
      expect(repos.tenantRepository.findById).toHaveBeenCalledTimes(2);
    });

    it('keeps userTenantName null when the home tenant is gone or lookup fails', async () => {
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.hubMembershipRepository.findByHub.mockResolvedValue([createMembership(HUB_ID, USER_A, 'owner')]);
      repos.userRepository.findByIdRaw.mockResolvedValue({
        serialize: () => ({ displayName: 'A', email: 'a@x.com', tenantId: 'tenant-gone' }),
      });
      repos.tenantRepository.findById.mockResolvedValue(null);

      const members = await service.listMembers(HUB_ID);
      expect(members[0].userTenantId).toBe('tenant-gone');
      expect(members[0].userTenantName).toBeNull();
    });

    it('throws NotFoundError for missing hub', async () => {
      repos.hubRepository.findById.mockResolvedValue(null);
      await expect(service.listMembers('nope')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAccessibleTenants', () => {
    it('maps hub memberships to their tenant list', async () => {
      repos.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER_A, 'admin'),
      ]);
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.tenantRepository.findByHubId.mockResolvedValue([
        createTenant('tenant-a', 'Alpha Kopi', HUB_ID),
        createTenant('tenant-b', 'Beta Resto', HUB_ID),
      ]);

      const result = await service.findAccessibleTenants(USER_A);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ tenantId: 'tenant-a', tenantName: 'Alpha Kopi', hubId: HUB_ID, hubName: 'BCA Hospitality', role: 'admin' });
      expect(result.map((r) => r.tenantId).sort()).toEqual(['tenant-a', 'tenant-b']);
    });

    it('skips inactive hubs and memberships to missing hubs', async () => {
      repos.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership('hub-active', USER_A, 'admin'),
        createMembership('hub-inactive', USER_A, 'admin'),
        createMembership('hub-gone', USER_A, 'admin'),
      ]);
      repos.hubRepository.findById.mockImplementation(async (id: string) => {
        if (id === 'hub-active') return createHub('hub-active', 'Aktif', 'active');
        if (id === 'hub-inactive') return createHub('hub-inactive', 'Nonaktif', 'suspended');
        return null;
      });
      repos.tenantRepository.findByHubId.mockResolvedValue([]);

      const result = await service.findAccessibleTenants(USER_A);
      expect(result).toEqual([]);
    });
  });

  describe('resolveRoleForTenant', () => {
    it('returns the membership role for a covered tenant', async () => {
      repos.hubMembershipRepository.findByUser.mockResolvedValue([createMembership(HUB_ID, USER_A, 'viewer')]);
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.tenantRepository.findByHubId.mockResolvedValue([createTenant('tenant-a', 'Alpha', HUB_ID)]);

      expect(await service.resolveRoleForTenant(USER_A, 'tenant-a')).toBe('viewer');
      expect(await service.resolveRoleForTenant(USER_A, 'tenant-other')).toBeNull();
    });
  });
  // Hub V2 Fase 20 — suspension is a tombstone, not a deletion. Each case below
  // exists because the "obvious" cheaper implementation would reopen the
  // ADR D3 zero-grant fallback and hand the member hub-wide owner authority.

  describe('suspendMembership', () => {
    it('marks the membership suspended, keeping role and row', async () => {
      const membership = createMembership(HUB_ID, USER_A, 'manager');
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(membership);

      expect(await service.suspendMembership(HUB_ID, USER_A)).toBe(true);
      expect(membership.serialize().status).toBe('suspended');
      expect(membership.serialize().suspendedAt).toBeInstanceOf(Date);
      // The role survives, so unsuspending restores the previous authority.
      expect(membership.serialize().role).toBe('manager');
      expect(repos.hubMembershipRepository.save).toHaveBeenCalledWith(membership);
      expect(repos.hubMembershipRepository.deleteByHubAndUser).not.toHaveBeenCalled();
    });

    it('returns false for an unknown member and an already suspended one', async () => {
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);
      expect(await service.suspendMembership(HUB_ID, USER_A)).toBe(false);

      const suspended = createMembership(HUB_ID, USER_A, 'manager');
      suspended.suspend();
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(suspended);
      expect(await service.suspendMembership(HUB_ID, USER_A)).toBe(false);
      expect(repos.hubMembershipRepository.save).not.toHaveBeenCalled();
    });

    it('refuses to suspend inside an archived hub', async () => {
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(createMembership(HUB_ID, USER_A, 'viewer'));
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID, 'Group', 'archived'));

      await expect(service.suspendMembership(HUB_ID, USER_A)).rejects.toThrow(ValidationError);
    });
  });

  describe('reactivateMembership', () => {
    it('clears the suspension and keeps the stored role', async () => {
      const membership = createMembership(HUB_ID, USER_A, 'admin');
      membership.suspend();
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(membership);

      expect(await service.reactivateMembership(HUB_ID, USER_A)).toBe(true);
      expect(membership.serialize().status).toBe('active');
      expect(membership.serialize().suspendedAt).toBeNull();
      expect(membership.serialize().role).toBe('admin');
    });

    it('returns false for an unknown member and an already active one', async () => {
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);
      expect(await service.reactivateMembership(HUB_ID, USER_A)).toBe(false);

      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(createMembership(HUB_ID, USER_A, 'viewer'));
      expect(await service.reactivateMembership(HUB_ID, USER_A)).toBe(false);
      expect(repos.hubMembershipRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('addMembership over a suspended row', () => {
    it('reactivates and applies the requested role instead of reporting a duplicate', async () => {
      service = new HubMembershipService({ ...repos, accessService } as any);
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.userRepository.findByIdRaw.mockResolvedValue({ id: USER_A });
      const suspended = createMembership(HUB_ID, USER_A, 'viewer');
      suspended.suspend();
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(suspended);

      await service.addMembership(HUB_ID, USER_A, 'manager');

      expect(suspended.serialize().status).toBe('active');
      expect(suspended.serialize().role).toBe('manager');
      // Grants that were suspended on removal are revived with their stored role
      // and outlet scope, so the D3 baseline stays consistent with the membership.
      expect(accessService.syncDefaultGrantsForMember).toHaveBeenCalledWith(HUB_ID, USER_A);
    });

    it('never suspends grants as a side effect of a suspension', async () => {
      service = new HubMembershipService({ ...repos, accessService } as any);
      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(createMembership(HUB_ID, USER_A, 'viewer'));

      await service.suspendMembership(HUB_ID, USER_A);

      // Suspending the membership is enough on its own: the access paths gate on
      // the membership, so touching the grants here would only add a second
      // source of truth that could drift on reactivation.
      expect(accessService.suspendAllGrantsForMember).not.toHaveBeenCalled();
    });
  });

  describe('findMembership / listMembers', () => {
    it('exposes the status so callers can tell a pause from a removal', async () => {
      const active = createMembership(HUB_ID, USER_A, 'viewer');
      const paused = createMembership(HUB_ID, USER_B, 'manager', 'm-b');
      paused.suspend();

      repos.hubMembershipRepository.findByHubAndUser.mockResolvedValue(paused);
      expect((await service.findMembership(HUB_ID, USER_B))!.serialize().status).toBe('suspended');

      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.hubMembershipRepository.findByHub.mockResolvedValue([active, paused]);
      repos.userRepository.findByIdRaw.mockResolvedValue(null);

      const rows = await service.listMembers(HUB_ID);
      expect(rows.map((r: any) => r.status)).toEqual(['active', 'suspended']);
      // A suspended member is still listed: the point is to make them
      // reactivatable, not invisible.
      expect(rows.map((r: any) => r.userId)).toEqual([USER_A, USER_B]);
    });

    it('skips suspended memberships when resolving accessible tenants', async () => {
      const paused = createMembership(HUB_ID, USER_A, 'viewer');
      paused.suspend();
      repos.hubMembershipRepository.findByUser.mockResolvedValue([paused]);
      repos.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      repos.tenantRepository.findByHubId.mockResolvedValue([createTenant('tenant-a', 'Alpha', HUB_ID)]);

      expect(await service.findAccessibleTenants(USER_A)).toEqual([]);
      expect(await service.resolveRoleForTenant(USER_A, 'tenant-a')).toBeNull();
    });
  });

});
