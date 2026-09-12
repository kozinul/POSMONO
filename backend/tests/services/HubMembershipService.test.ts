import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HubMembershipService } from '../../src/core/hub/application/services/HubMembershipService';
import { Hub } from '../../src/core/hub/domain/Hub';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { ConflictError, NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';

const HUB_ID = 'hub-1';
const USER_A = 'user-a';
const USER_B = 'user-b';

function createHub(id: string, name = 'BCA Hospitality', isActive = true) {
  return Hub.hydrate({
    id,
    name,
    description: null,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
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

function createTenant(id: string, name: string, hubId: string) {
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
    findById: vi.fn(),
    findByName: vi.fn(),
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

  beforeEach(() => {
    repos = createMockRepos();
    service = new HubMembershipService(repos as any);
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
        if (id === 'hub-active') return createHub('hub-active', 'Aktif', true);
        if (id === 'hub-inactive') return createHub('hub-inactive', 'Nonaktif', false);
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
});