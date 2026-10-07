import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HubMemberAccessService } from '../../src/core/hub/application/services/HubMemberAccessService';
import { HubMemberTenantAccess } from '../../src/core/hub/domain/HubMemberTenantAccess';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { makeHub, type HubStatus } from '../fixtures/hub.fixtures';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';
import { TENANT_ACCESS_ROLE_PERMS } from '../../src/core/platform/defaults/roles';

const HUB_ID = 'hub-1';
const OTHER_HUB = 'hub-2';
const USER = 'user-a';
const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const TENANT_OTHER_HUB = 'tenant-c';

function createHub(id: string, status: HubStatus = 'active') {
  return makeHub({ id, name: `Hub ${id}`, code: id.toUpperCase(), status });
}

function createMembership(hubId: string, userId: string, role: string) {
  return HubMembership.hydrate({
    id: `m-${hubId}-${userId}`,
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

function createOutlet(id: string, tenantId: string) {
  return { serialize: () => ({ id, name: id, tenantId }) };
}

function createMocks() {
  const accessRepository = {
    save: vi.fn(),
    findById: vi.fn(),
    findByHubUserTenant: vi.fn(async () => null),
    findByHubAndUser: vi.fn(async () => []),
    findByUser: vi.fn(async () => []),
    findByHubAndTenant: vi.fn(async () => []),
    deleteByHubUserTenant: vi.fn(async () => true),
  };
  const hubMembershipRepository = {
    save: vi.fn(),
    findById: vi.fn(),
    findByHubAndUser: vi.fn(async () => null),
    findByHub: vi.fn(async () => []),
    findByUser: vi.fn(async () => []),
    deleteByHubAndUser: vi.fn(async () => true),
  };
  const hubRepository = { findById: vi.fn(async () => null) };
  const tenantRepository = {
    findById: vi.fn(async () => null),
    findByHubId: vi.fn(async () => []),
  };
  const outletRepository = { findByTenant: vi.fn(async () => []) };
  return { accessRepository, hubMembershipRepository, hubRepository, tenantRepository, outletRepository };
}

type Mocks = ReturnType<typeof createMocks>;

/**
 * The grant path re-verifies that the row still points at a live hub, a live
 * membership and a tenant owned by that hub — so every grant test needs those
 * three lookups to line up.
 */
function linkGrant(
  mocks: Mocks,
  hubId = HUB_ID,
  tenantId = TENANT_A,
  userId = USER,
  isActive = true,
) {
  mocks.hubRepository.findById.mockResolvedValue(createHub(hubId, isActive ? 'active' : 'suspended'));
  mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
    createMembership(hubId, userId, 'admin'),
  );
  mocks.tenantRepository.findById.mockResolvedValue(createTenant(tenantId, 'Alpha Kopi', hubId));
}

function grant(overrides: Record<string, unknown> = {}) {
  return HubMemberTenantAccess.create({
    hubId: HUB_ID,
    userId: USER,
    tenantId: TENANT_A,
    tenantRole: 'manager',
    outletIds: [],
    status: 'active',
    ...overrides,
  });
}

describe('HubMemberAccessService', () => {
  let mocks: ReturnType<typeof createMocks>;
  let service: HubMemberAccessService;

  beforeEach(() => {
    mocks = createMocks();
    service = new HubMemberAccessService(mocks as any);
  });

  // ------------------------------------------------------------ happy path

  describe('grantAccess', () => {
    it('creates an active grant for a member of the hub', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'admin'),
      );
      mocks.tenantRepository.findById.mockResolvedValue(createTenant(TENANT_A, 'Alpha Kopi', HUB_ID));

      const grant = await service.grantAccess({
        hubId: HUB_ID,
        userId: USER,
        tenantId: TENANT_A,
        tenantRole: 'manager',
      });

      const data = grant.serialize();
      expect(data.tenantRole).toBe('manager');
      expect(data.status).toBe('active');
      expect(data.outletIds).toEqual([]);
      expect(mocks.accessRepository.save).toHaveBeenCalledOnce();
    });

    it('rejects a duplicate grant instead of silently overwriting', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'admin'),
      );
      mocks.tenantRepository.findById.mockResolvedValue(createTenant(TENANT_A, 'Alpha Kopi', HUB_ID));
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(
        HubMemberTenantAccess.create({
          hubId: HUB_ID,
          userId: USER,
          tenantId: TENANT_A,
          tenantRole: 'viewer',
          outletIds: [],
          status: 'active',
        }),
      );

      await expect(
        service.grantAccess({ hubId: HUB_ID, userId: USER, tenantId: TENANT_A, tenantRole: 'manager' }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('rejects a user who is not a member of the hub', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);

      await expect(
        service.grantAccess({ hubId: HUB_ID, userId: USER, tenantId: TENANT_A, tenantRole: 'viewer' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects a tenant that belongs to another hub', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'admin'),
      );
      mocks.tenantRepository.findById.mockResolvedValue(
        createTenant(TENANT_OTHER_HUB, 'Gamma', OTHER_HUB),
      );

      await expect(
        service.grantAccess({ hubId: HUB_ID, userId: USER, tenantId: TENANT_OTHER_HUB, tenantRole: 'viewer' }),
      ).rejects.toThrow(/does not belong to this hub/);
    });

    it('rejects an unknown tenant role', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'admin'),
      );
      mocks.tenantRepository.findById.mockResolvedValue(createTenant(TENANT_A, 'Alpha Kopi', HUB_ID));

      await expect(
        service.grantAccess({ hubId: HUB_ID, userId: USER, tenantId: TENANT_A, tenantRole: 'superadmin' as any }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects an outlet from another tenant — the narrowing must not leak', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'admin'),
      );
      mocks.tenantRepository.findById.mockResolvedValue(createTenant(TENANT_A, 'Alpha Kopi', HUB_ID));
      mocks.outletRepository.findByTenant.mockResolvedValue([createOutlet('outlet-a', TENANT_A)]);

      await expect(
        service.grantAccess({
          hubId: HUB_ID,
          userId: USER,
          tenantId: TENANT_A,
          tenantRole: 'manager',
          outletIds: ['outlet-a', 'outlet-b'],
        }),
      ).rejects.toThrow(/Outlet does not belong to this tenant/);
    });
  });

  describe('updateAccess / setOutlets / revokeAccess', () => {
    it('changes role and outlet scope on an existing grant', async () => {
      const grant = HubMemberTenantAccess.create({
        hubId: HUB_ID,
        userId: USER,
        tenantId: TENANT_A,
        tenantRole: 'viewer',
        outletIds: [],
        status: 'active',
      });
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(grant);
      mocks.outletRepository.findByTenant.mockResolvedValue([createOutlet('outlet-a', TENANT_A)]);

      const updated = await service.updateAccess(HUB_ID, USER, TENANT_A, {
        tenantRole: 'cashier',
        outletIds: ['outlet-a', 'outlet-a'],
      });

      const data = updated.serialize();
      expect(data.tenantRole).toBe('cashier');
      // de-duplicated on write
      expect(data.outletIds).toEqual(['outlet-a']);
      expect(mocks.accessRepository.save).toHaveBeenCalledOnce();
    });

    it('suspends without deleting the row', async () => {
      const grant = HubMemberTenantAccess.create({
        hubId: HUB_ID,
        userId: USER,
        tenantId: TENANT_A,
        tenantRole: 'manager',
        outletIds: [],
        status: 'active',
      });
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(grant);

      const suspended = await service.updateAccess(HUB_ID, USER, TENANT_A, { status: 'suspended' });
      expect(suspended.serialize().status).toBe('suspended');
      expect(mocks.accessRepository.deleteByHubUserTenant).not.toHaveBeenCalled();
    });

    it('404s when narrowing a grant that does not exist', async () => {
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(null);
      await expect(service.setOutlets(HUB_ID, USER, TENANT_A, ['outlet-a'])).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('setAccess upserts so a first grant works through the same endpoint', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'admin'),
      );
      mocks.tenantRepository.findById.mockResolvedValue(createTenant(TENANT_A, 'Alpha Kopi', HUB_ID));
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(null);

      const created = await service.setAccess({
        hubId: HUB_ID,
        userId: USER,
        tenantId: TENANT_A,
        tenantRole: 'viewer',
      });
      expect(created.serialize().tenantRole).toBe('viewer');
      expect(mocks.accessRepository.save).toHaveBeenCalledOnce();
    });

    it('setAccess updates in place when the grant already exists', async () => {
      const grant = HubMemberTenantAccess.create({
        hubId: HUB_ID,
        userId: USER,
        tenantId: TENANT_A,
        tenantRole: 'viewer',
        outletIds: [],
        status: 'active',
      });
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(grant);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'admin'),
      );
      mocks.tenantRepository.findById.mockResolvedValue(createTenant(TENANT_A, 'Alpha Kopi', HUB_ID));

      const updated = await service.setAccess({
        hubId: HUB_ID,
        userId: USER,
        tenantId: TENANT_A,
        tenantRole: 'manager',
        outletIds: [],
      });
      expect(updated.serialize().tenantRole).toBe('manager');
    });
  });

  // ------------------------------------------------- session resolution (DENY)

  describe('resolveSessionFor', () => {
    it('returns the granted tenant role and outlet scope', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([
        HubMemberTenantAccess.create({
          hubId: HUB_ID,
          userId: USER,
          tenantId: TENANT_A,
          tenantRole: 'manager',
          outletIds: ['outlet-a'],
          status: 'active',
        }),
      ]);
      linkGrant(mocks);

      const session = await service.resolveSessionFor(USER, TENANT_A);
      expect(session).not.toBeNull();
      expect(session!.source).toBe('grant');
      expect(session!.tenantRole).toBe('manager');
      expect(session!.outletIds).toEqual(['outlet-a']);
      expect(session!.permissions).toEqual(TENANT_ACCESS_ROLE_PERMS.manager);
    });

    it('DENIES a tenant that has no grant once grants exist', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([
        HubMemberTenantAccess.create({
          hubId: HUB_ID,
          userId: USER,
          tenantId: TENANT_A,
          tenantRole: 'manager',
          outletIds: [],
          status: 'active',
        }),
      ]);

      // hub role is `owner` — under pre-Fase 17 rules this would have been a
      // full Owner session. With grants it must be refused.
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
      ]);

      expect(await service.resolveSessionFor(USER, TENANT_B)).toBeNull();
    });

    it('DENIES a suspended grant', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([
        HubMemberTenantAccess.create({
          hubId: HUB_ID,
          userId: USER,
          tenantId: TENANT_A,
          tenantRole: 'manager',
          outletIds: [],
          status: 'suspended',
        }),
      ]);

      expect(await service.resolveSessionFor(USER, TENANT_A)).toBeNull();
    });

    it('falls back to the hub role when the member has no grants at all (ADR D3)', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([]);
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.tenantRepository.findByHubId.mockResolvedValue([
        createTenant(TENANT_A, 'Alpha Kopi', HUB_ID),
        createTenant(TENANT_B, 'Beta Resto', HUB_ID),
      ]);

      const session = await service.resolveSessionFor(USER, TENANT_B);
      expect(session!.source).toBe('fallback');
      expect(session!.hubRole).toBe('owner');
      // pre-Fase 17 contract preserved: all outlets, owner permissions
      expect(session!.outletIds).toEqual([]);
      expect(session!.permissions).toEqual(expect.arrayContaining(['settings:write', 'users:write']));
    });

    it('does not fall back to a suspended hub', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([]);
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID, 'suspended'));
      mocks.tenantRepository.findByHubId.mockResolvedValue([createTenant(TENANT_A, 'Alpha', HUB_ID)]);

      expect(await service.resolveSessionFor(USER, TENANT_A)).toBeNull();
    });

    it('denies a tenant outside every hub the member belongs to', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([]);
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'admin'),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.tenantRepository.findByHubId.mockResolvedValue([createTenant(TENANT_A, 'Alpha', HUB_ID)]);

      expect(await service.resolveSessionFor(USER, TENANT_OTHER_HUB)).toBeNull();
    });

    it('DENIES a grant whose membership was removed — a row cannot outlive the membership', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([grant()]);
      // membership gone (member removed from the hub, grant row left behind)
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);
      mocks.tenantRepository.findById.mockResolvedValue(createTenant(TENANT_A, 'Alpha', HUB_ID));

      expect(await service.resolveSessionFor(USER, TENANT_A)).toBeNull();
    });

    it('DENIES a grant on a hub that was deactivated', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([grant()]);
      linkGrant(mocks, HUB_ID, TENANT_A, USER, false);

      expect(await service.resolveSessionFor(USER, TENANT_A)).toBeNull();
    });

    it('DENIES a grant whose tenant was moved to another hub', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([grant()]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'admin'),
      );
      mocks.tenantRepository.findById.mockResolvedValue(createTenant(TENANT_A, 'Alpha', OTHER_HUB));

      expect(await service.resolveSessionFor(USER, TENANT_A)).toBeNull();
    });

    it('assertSession throws ForbiddenError for a missing session', () => {
      expect(() => service.assertSession(null, TENANT_A)).toThrow(ForbiddenError);
    });
  });

  // ----------------------------------------------------- revoke / D3 baseline

  describe('revokeAccess', () => {
    it('suspends and keeps the row — a delete would restore broad access via fallback', async () => {
      const existing = grant();
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(existing);

      expect(await service.revokeAccess(HUB_ID, USER, TENANT_A)).toBe(true);
      expect(existing.serialize().status).toBe('suspended');
      expect(mocks.accessRepository.save).toHaveBeenCalledOnce();
      expect(mocks.accessRepository.deleteByHubUserTenant).not.toHaveBeenCalled();
    });

    it('reports nothing to do for an unknown grant', async () => {
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(null);
      expect(await service.revokeAccess(HUB_ID, USER, TENANT_A)).toBe(false);
    });

    it('reports nothing to do when the grant is already suspended', async () => {
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(grant({ status: 'suspended' }));
      expect(await service.revokeAccess(HUB_ID, USER, TENANT_A)).toBe(false);
    });

    it('a suspended-only member stays denied instead of falling back', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([grant({ status: 'suspended' })]);
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
      ]);

      expect(await service.resolveSessionFor(USER, TENANT_A)).toBeNull();
    });
  });

  describe('syncDefaultGrantsForMember (ADR D3)', () => {
    it('creates a viewer grant for every tenant of the hub', async () => {
      mocks.tenantRepository.findByHubId.mockResolvedValue([
        createTenant(TENANT_A, 'Alpha Kopi', HUB_ID),
        createTenant(TENANT_B, 'Beta Resto', HUB_ID),
      ]);
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(null);

      const created = await service.syncDefaultGrantsForMember(HUB_ID, USER);
      expect(created).toBe(2);
      const saved = mocks.accessRepository.save.mock.calls.map(([g]: any) => g.serialize());
      expect(saved.map((s: any) => s.tenantRole)).toEqual(['viewer', 'viewer']);
      expect(saved.map((s: any) => s.tenantId).sort()).toEqual([TENANT_A, TENANT_B].sort());
      expect(saved.every((s: any) => s.outletIds.length === 0 && s.status === 'active')).toBe(true);
    });

    it('reactivates a suspended grant without resetting its role or outlets', async () => {
      const existing = grant({ status: 'suspended', tenantRole: 'manager', outletIds: ['outlet-a'] });
      mocks.tenantRepository.findByHubId.mockResolvedValue([createTenant(TENANT_A, 'Alpha', HUB_ID)]);
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(existing);

      const created = await service.syncDefaultGrantsForMember(HUB_ID, USER);
      expect(created).toBe(0);
      const data = existing.serialize();
      expect(data.status).toBe('active');
      expect(data.tenantRole).toBe('manager');
      expect(data.outletIds).toEqual(['outlet-a']);
    });

    it('leaves an already-active grant untouched', async () => {
      mocks.tenantRepository.findByHubId.mockResolvedValue([createTenant(TENANT_A, 'Alpha', HUB_ID)]);
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(grant());

      expect(await service.syncDefaultGrantsForMember(HUB_ID, USER)).toBe(0);
      expect(mocks.accessRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('suspendAllGrantsForMember', () => {
    it('suspends every active grant of the member in that hub', async () => {
      const a = grant({ tenantId: TENANT_A });
      const b = grant({ tenantId: TENANT_B });
      mocks.accessRepository.findByHubAndUser.mockResolvedValue([a, b]);

      expect(await service.suspendAllGrantsForMember(HUB_ID, USER)).toBe(2);
      expect(a.serialize().status).toBe('suspended');
      expect(b.serialize().status).toBe('suspended');
    });

    it('skips rows that are already suspended', async () => {
      mocks.accessRepository.findByHubAndUser.mockResolvedValue([
        grant({ tenantId: TENANT_A }),
        grant({ tenantId: TENANT_B, status: 'suspended' }),
      ]);

      expect(await service.suspendAllGrantsForMember(HUB_ID, USER)).toBe(1);
    });
  });

  describe('setAccess validation (create branch)', () => {
    it('rejects a cross-hub tenant on first write', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'admin'),
      );
      mocks.tenantRepository.findById.mockResolvedValue(
        createTenant(TENANT_OTHER_HUB, 'Gamma', OTHER_HUB),
      );

      await expect(
        service.setAccess({ hubId: HUB_ID, userId: USER, tenantId: TENANT_OTHER_HUB, tenantRole: 'viewer' }),
      ).rejects.toThrow(/does not belong to this hub/);
      expect(mocks.accessRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a cross-tenant outlet on first write', async () => {
      linkGrant(mocks);
      mocks.outletRepository.findByTenant.mockResolvedValue([createOutlet('outlet-a', TENANT_A)]);

      await expect(
        service.setAccess({
          hubId: HUB_ID,
          userId: USER,
          tenantId: TENANT_A,
          tenantRole: 'manager',
          outletIds: ['outlet-b'],
        }),
      ).rejects.toThrow(/Outlet does not belong to this tenant/);
      expect(mocks.accessRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a non-member on first write', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);

      await expect(
        service.setAccess({ hubId: HUB_ID, userId: USER, tenantId: TENANT_A, tenantRole: 'viewer' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects an invalid role on first write', async () => {
      linkGrant(mocks);
      await expect(
        service.setAccess({
          hubId: HUB_ID,
          userId: USER,
          tenantId: TENANT_A,
          tenantRole: 'root' as any,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('replaces a suspended grant and revives it when status is omitted', async () => {
      const existing = grant({ status: 'suspended', tenantRole: 'viewer' });
      mocks.accessRepository.findByHubUserTenant.mockResolvedValue(existing);
      linkGrant(mocks);

      const updated = await service.setAccess({
        hubId: HUB_ID,
        userId: USER,
        tenantId: TENANT_A,
        tenantRole: 'manager',
        outletIds: [],
      });
      expect(updated.serialize().status).toBe('active');
      expect(updated.serialize().tenantRole).toBe('manager');
    });
  });

  // ------------------------------------------------------- accessible tenants

  describe('findAccessibleTenants', () => {
    it('lists only granted tenants once grants exist', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([
        HubMemberTenantAccess.create({
          hubId: HUB_ID,
          userId: USER,
          tenantId: TENANT_B,
          tenantRole: 'manager',
          outletIds: ['outlet-b'],
          status: 'active',
        }),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.tenantRepository.findById.mockResolvedValue(createTenant(TENANT_B, 'Beta Resto', HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'owner'),
      );

      const rows = await service.findAccessibleTenants(USER);
      expect(rows).toHaveLength(1);
      expect(rows[0].tenantId).toBe(TENANT_B);
      expect(rows[0].accessSource).toBe('grant');
      expect(rows[0].tenantRole).toBe('manager');
      expect(rows[0].outletIds).toEqual(['outlet-b']);
    });

    it('hides a suspended grant from the switcher', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([
        HubMemberTenantAccess.create({
          hubId: HUB_ID,
          userId: USER,
          tenantId: TENANT_A,
          tenantRole: 'manager',
          outletIds: [],
          status: 'suspended',
        }),
      ]);

      expect(await service.findAccessibleTenants(USER)).toEqual([]);
    });

    it('hides a grant whose tenant was deleted', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([
        HubMemberTenantAccess.create({
          hubId: HUB_ID,
          userId: USER,
          tenantId: TENANT_A,
          tenantRole: 'manager',
          outletIds: [],
          status: 'active',
        }),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.tenantRepository.findById.mockResolvedValue(null);

      expect(await service.findAccessibleTenants(USER)).toEqual([]);
    });

    it('lists every tenant of an active hub when there are no grants (legacy)', async () => {
      mocks.accessRepository.findByUser.mockResolvedValue([]);
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'admin'),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.tenantRepository.findByHubId.mockResolvedValue([
        createTenant(TENANT_B, 'Beta Resto', HUB_ID),
        createTenant(TENANT_A, 'Alpha Kopi', HUB_ID),
      ]);

      const rows = await service.findAccessibleTenants(USER);
      expect(rows.map((r) => r.tenantId)).toEqual([TENANT_A, TENANT_B]);
      expect(rows[0].accessSource).toBe('fallback');
    });
  });

  describe('getContext', () => {
    it('reports hubs, grants, tenants and the union of effective permissions', async () => {
      const grant = HubMemberTenantAccess.create({
        hubId: HUB_ID,
        userId: USER,
        tenantId: TENANT_A,
        tenantRole: 'manager',
        outletIds: [],
        status: 'active',
      });
      mocks.accessRepository.findByUser.mockResolvedValue([grant]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.tenantRepository.findById.mockResolvedValue(createTenant(TENANT_A, 'Alpha Kopi', HUB_ID));
      // Fase 21 — `hubs` now comes from `listMyHubs`, which reads the member's own
      // rows (`findByUser`) instead of inferring hubs from reachable
      // tenants/grants. The per-hub lookup stays mocked because tenant
      // resolution (`grantedTenants`) still asks "is this an active member?"
      // individually.
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
      ]);
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'owner'),
      );

      const context = await service.getContext(USER);
      expect(context.hubs).toEqual([
      { id: HUB_ID, code: 'HUB-1', name: 'Hub hub-1', status: 'active', isActive: true },
    ]);
      expect(context.grants).toHaveLength(1);
      expect(context.grants[0].tenantRoleLabel).toBe('Manager');
      expect(context.grants[0].allOutlets).toBe(true);
      expect(context.tenants).toHaveLength(1);
      // reported sorted + de-duplicated, so a UI diff never flips on order
      expect(context.effectivePermissions).toEqual([...TENANT_ACCESS_ROLE_PERMS.manager].sort());
    });

    // The pre-Fase 21 implementation derived the hub list from reachable tenants
    // and grants, so a member of a hub they could not switch into saw no hub at
    // all — `/hub-context/me` and the hub switcher silently disagreed.
    it('lists a hub the member belongs to even when no grant or tenant is reachable', async () => {
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'viewer'),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));

      const context = await service.getContext(USER);
      expect(context.hubs).toEqual([
        { id: HUB_ID, code: 'HUB-1', name: 'Hub hub-1', status: 'active', isActive: true },
      ]);
      expect(context.tenants).toEqual([]);
    });
  });

  // ------------------------------------------------- blocked reason (2026-10-06)
  // "No hubs" is ambiguous: the console redirects when you belong to none, but
  // must *explain* when something was suspended. `blocked` is the difference.
  describe('getContext blocked reason', () => {
    it('explains a suspended membership and names the hub', async () => {
      const suspended = createMembership(HUB_ID, USER, 'owner');
      suspended.suspend();
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([suspended]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));

      const context = await service.getContext(USER);
      expect(context.hubs).toEqual([]);
      expect(context.blocked).toEqual({
        kind: 'membership_suspended',
        hubId: HUB_ID,
        hubName: 'Hub hub-1',
      });
    });

    it('explains a suspended hub', async () => {
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID, 'suspended'));

      const context = await service.getContext(USER);
      expect(context.hubs).toEqual([]);
      expect(context.blocked).toEqual({ kind: 'hub_suspended', hubId: HUB_ID, hubName: 'Hub hub-1' });
    });

    it('distinguishes an archived hub from a suspended one', async () => {
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID, 'archived'));

      const context = await service.getContext(USER);
      expect(context.blocked).toEqual({ kind: 'hub_archived', hubId: HUB_ID, hubName: 'Hub hub-1' });
    });

    it('leaves blocked null when the member belongs to no hub at all', async () => {
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([]);

      const context = await service.getContext(USER);
      expect(context.hubs).toEqual([]);
      expect(context.blocked).toBeNull();
    });

    it('skips a deleted hub — "hub gone" is not an actionable status', async () => {
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(null);

      const context = await service.getContext(USER);
      expect(context.hubs).toEqual([]);
      expect(context.blocked).toBeNull();
    });

    it('never sets blocked while a usable hub remains', async () => {
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));

      const context = await service.getContext(USER);
      expect(context.hubs).toHaveLength(1);
      expect(context.blocked).toBeNull();
    });
  });

  describe('listMyHubs (Fase 21)', () => {
    it('reports role, label and the hub.* namespace of the role', async () => {
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'manager'),
      ]);
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));

      const rows = await service.listMyHubs(USER);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: HUB_ID, code: 'HUB-1', status: 'active', role: 'manager' });
      expect(rows[0].roleLabel).toBe('Hub Manager');
      expect(rows[0].permissions).toContain('hub.reports.read');
      expect(rows[0].permissions).not.toContain('hub.members.manage');
    });

    it('omits suspended memberships and non-operational hubs', async () => {
      const suspended = createMembership(HUB_ID, USER, 'owner');
      suspended.suspend();
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        suspended,
        createMembership(OTHER_HUB, USER, 'owner'),
      ]);
      mocks.hubRepository.findById.mockImplementation(async (id: string) =>
        id === HUB_ID ? createHub(HUB_ID) : createHub(OTHER_HUB, 'suspended'),
      );

      const rows = await service.listMyHubs(USER);
      expect(rows).toEqual([]);
    });

    it('skips a hub that was deleted under a live membership', async () => {
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
      ]);
      mocks.hubRepository.findById.mockImplementation(async () => {
        throw new Error('hub gone');
      });

      await expect(service.listMyHubs(USER)).resolves.toEqual([]);
    });

    it('sorts by name so a multi-hub member sees a stable order', async () => {
      mocks.hubMembershipRepository.findByUser.mockResolvedValue([
        createMembership(HUB_ID, USER, 'owner'),
        createMembership(OTHER_HUB, USER, 'viewer'),
      ]);
      mocks.hubRepository.findById.mockImplementation(async (id: string) =>
        id === HUB_ID
          ? makeHub({ id, name: 'Zulu Group', code: 'ZULU' })
          : makeHub({ id, name: 'Alfa Group', code: 'ALFA' }),
      );

      const rows = await service.listMyHubs(USER);
      expect(rows.map((r) => r.name)).toEqual(['Alfa Group', 'Zulu Group']);
    });
  });

  describe('assertHubPermission (Fase 21)', () => {
    it('returns the role and permissions of an active member', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'manager'),
      );

      const access = await service.assertHubPermission(HUB_ID, USER, 'hub.reports.read');
      expect(access.role).toBe('manager');
      expect(access.hub.serialize().id).toBe(HUB_ID);
    });

    it('404s on an unknown hub before asking about membership', async () => {
      mocks.hubRepository.findById.mockResolvedValue(null);
      await expect(service.assertHubPermission(HUB_ID, USER, 'hub.read')).rejects.toThrow(NotFoundError);
      expect(mocks.hubMembershipRepository.findByHubAndUser).not.toHaveBeenCalled();
    });

    it('403s a non-member', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(null);
      await expect(service.assertHubPermission(HUB_ID, USER, 'hub.read')).rejects.toThrow(ForbiddenError);
    });

    it('403s a suspended member', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      const suspended = createMembership(HUB_ID, USER, 'owner');
      suspended.suspend();
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(suspended);
      await expect(service.assertHubPermission(HUB_ID, USER, 'hub.read')).rejects.toThrow(ForbiddenError);
    });

    it('403s a member of a suspended or archived hub', async () => {
      for (const status of ['suspended', 'archived'] as HubStatus[]) {
        mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID, status));
        mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
          createMembership(HUB_ID, USER, 'owner'),
        );
        await expect(service.assertHubPermission(HUB_ID, USER, 'hub.read')).rejects.toThrow(ForbiddenError);
      }
    });

    it('403s and names the missing permission', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'viewer'),
      );
      await expect(service.assertHubPermission(HUB_ID, USER, 'hub.reports.read')).rejects.toThrow(
        /hub\.reports\.read/,
      );
    });

    it('requires every listed permission, not just one of them', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'manager'),
      );
      // manager reads reports but does not manage members.
      await expect(
        service.assertHubPermission(HUB_ID, USER, 'hub.reports.read', 'hub.members.manage'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('lets an active member through with no permission required', async () => {
      mocks.hubRepository.findById.mockResolvedValue(createHub(HUB_ID));
      mocks.hubMembershipRepository.findByHubAndUser.mockResolvedValue(
        createMembership(HUB_ID, USER, 'viewer'),
      );
      const access = await service.assertHubPermission(HUB_ID, USER);
      expect(access.permissions).toEqual(['hub.read']);
    });
  });
});
