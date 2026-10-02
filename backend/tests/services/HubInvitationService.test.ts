import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubInvitationService } from '../../src/core/hub/application/services/HubInvitationService';
import {
  HubInvitation,
  HUB_INVITATION_MAX_TTL_HOURS,
  HUB_INVITATION_MIN_TTL_HOURS,
  normalizeInvitationEmail,
} from '../../src/core/hub/domain/HubInvitation';
import { HubMembership } from '../../src/core/hub/domain/HubMembership';
import { hashInvitationToken } from '../../src/core/hub/domain/invitationToken';

const HUB = 'hub-1';
const USER = 'user-1';
const ADMIN = 'platform-admin';

function createHub(status: 'active' | 'suspended' | 'archived' = 'active') {
  return {
    isArchived: () => status === 'archived',
    isOperational: () => status === 'active',
    serialize: () => ({ id: HUB, code: 'GRP-ONE', name: 'Group One', status }),
  };
}

function createUser(id = USER, email = 'budi@kopi.id') {
  return { id: { toValue: () => id }, emailValue: email };
}

function createMembership(overrides: Record<string, unknown> = {}) {
  return HubMembership.hydrate({
    id: `m-${HUB}-${USER}`,
    hubId: HUB,
    userId: USER,
    role: 'viewer',
    status: 'active',
    suspendedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any);
}

function createMocks() {
  const invitationRepository = {
    save: vi.fn(),
    findById: vi.fn(async () => null),
    findByTokenHash: vi.fn(async () => null),
    findPendingByHubAndEmail: vi.fn(async () => null),
    findByHub: vi.fn(async () => []),
    countUsablePendingByHub: vi.fn(async () => 0),
    deleteById: vi.fn(async () => true),
  };
  const hubRepository = { findById: vi.fn(async () => createHub()) };
  const membershipService = {
    addMembership: vi.fn(async () => createMembership({ role: 'manager' })),
    findMembership: vi.fn(async () => null),
  };
  const userRepository = {
    findByIdRaw: vi.fn(async () => createUser()),
    findByEmailGlobal: vi.fn(async () => null),
  };
  return { invitationRepository, hubRepository, membershipService, userRepository };
}

type Mocks = ReturnType<typeof createMocks>;

function buildService(mocks: Mocks) {
  return new HubInvitationService({
    invitationRepository: mocks.invitationRepository as any,
    hubRepository: mocks.hubRepository as any,
    membershipService: mocks.membershipService as any,
    userRepository: mocks.userRepository as any,
  });
}

/** The service persists an invitation it just built; capture it for the caller. */
function captureSaved(mocks: Mocks) {
  return () => mocks.invitationRepository.save.mock.calls[0][0] as HubInvitation;
}

describe('HubInvitationService', () => {
  let mocks: Mocks;
  let service: HubInvitationService;

  beforeEach(() => {
    mocks = createMocks();
    service = buildService(mocks);
  });

  // ------------------------------------------------------------------ create

  describe('create', () => {
    it('stores only the token digest and returns the raw token exactly once', async () => {
      const created = await service.create({ hubId: HUB, email: 'Budi@Kopi.ID', role: 'manager', invitedBy: ADMIN });

      const saved = captureSaved(mocks)();
      expect(saved.serialize().tokenHash).toBe(hashInvitationToken(created.token));
      expect(saved.serialize().tokenHash).not.toBe(created.token);
      // The API view must not carry the digest either: it is one step from being
      // used as a credential by anyone who can read the response.
      expect((created.invitation as Record<string, unknown>).tokenHash).toBeUndefined();
      expect(created.token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('normalises the address so case and angle brackets cannot dodge the duplicate guard', async () => {
      await service.create({ hubId: HUB, email: '  <Budi@Kopi.ID> ', role: 'viewer', invitedBy: ADMIN });

      expect(mocks.invitationRepository.findPendingByHubAndEmail).toHaveBeenCalledWith(
        HUB,
        'budi@kopi.id',
      );
      expect(captureSaved(mocks)().serialize().email).toBe('budi@kopi.id');
    });

    it('rejects a malformed address', async () => {
      await expect(
        service.create({ hubId: HUB, email: 'budi-at-kopi', role: 'viewer', invitedBy: ADMIN }),
      ).rejects.toThrow(/email undangan tidak valid/i);
      expect(mocks.invitationRepository.save).not.toHaveBeenCalled();
    });

    it('rejects an unknown hub role', async () => {
      await expect(
        service.create({ hubId: HUB, email: 'budi@kopi.id', role: 'superuser' as any, invitedBy: ADMIN }),
      ).rejects.toThrow(/Role hub tidak valid/i);
    });

    it('404s an unknown hub and refuses an archived one', async () => {
      mocks.hubRepository.findById.mockResolvedValue(null as any);
      await expect(
        service.create({ hubId: HUB, email: 'budi@kopi.id', role: 'viewer', invitedBy: ADMIN }),
      ).rejects.toThrow(/Hub/);

      mocks.hubRepository.findById.mockResolvedValue(createHub('archived') as any);
      await expect(
        service.create({ hubId: HUB, email: 'budi@kopi.id', role: 'viewer', invitedBy: ADMIN }),
      ).rejects.toThrow(/archived/);
    });

    it('refuses to invite somebody who is already a member', async () => {
      mocks.userRepository.findByEmailGlobal.mockResolvedValue(createUser() as any);
      mocks.membershipService.findMembership.mockResolvedValue(createMembership() as any);

      await expect(
        service.create({ hubId: HUB, email: 'budi@kopi.id', role: 'viewer', invitedBy: ADMIN }),
      ).rejects.toThrow(/sudah menjadi anggota/i);
    });

    it('refuses a second open invitation for the same address', async () => {
      mocks.invitationRepository.findPendingByHubAndEmail.mockResolvedValue(
        HubInvitation.create({
          hubId: HUB,
          email: 'budi@kopi.id',
          role: 'viewer',
          tokenHash: 'hash',
          expiresAt: new Date(Date.now() + 60_000),
          invitedBy: ADMIN,
        }) as any,
      );

      await expect(
        service.create({ hubId: HUB, email: 'budi@kopi.id', role: 'viewer', invitedBy: ADMIN }),
      ).rejects.toThrow(/Sudah ada undangan menunggu/i);
    });

    it('re-invites an address whose only invitation has lapsed', async () => {
      const lapsed = HubInvitation.create({
        hubId: HUB,
        email: 'budi@kopi.id',
        role: 'viewer',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 1_000),
        invitedBy: ADMIN,
      });
      mocks.invitationRepository.findPendingByHubAndEmail.mockResolvedValue(lapsed as any);

      await service.create({ hubId: HUB, email: 'budi@kopi.id', role: 'manager', invitedBy: ADMIN });

      // The stale row is stamped so it stops occupying the (hub, email, pending) slot.
      expect(lapsed.serialize().status).toBe('expired');
      expect(mocks.invitationRepository.save).toHaveBeenCalled();
    });

    it('translates a duplicate-key race into a conflict', async () => {
      mocks.invitationRepository.save.mockRejectedValueOnce({ code: 11000 });

      await expect(
        service.create({ hubId: HUB, email: 'budi@kopi.id', role: 'viewer', invitedBy: ADMIN }),
      ).rejects.toThrow(/Sudah ada undangan menunggu/i);
    });

    it('clamps the requested lifetime into the supported range', async () => {
      await service.create({ hubId: HUB, email: 'a@kopi.id', role: 'viewer', expiresInHours: 9999, invitedBy: ADMIN });
      const long = captureSaved(mocks)().serialize().expiresAt.getTime() - Date.now();
      expect(long).toBeLessThanOrEqual(HUB_INVITATION_MAX_TTL_HOURS * 3_600_000 + 1_000);

      mocks.invitationRepository.save.mockClear();
      await service.create({ hubId: HUB, email: 'b@kopi.id', role: 'viewer', expiresInHours: 0, invitedBy: ADMIN });
      const short = captureSaved(mocks)().serialize().expiresAt.getTime() - Date.now();
      expect(short).toBeGreaterThanOrEqual(HUB_INVITATION_MIN_TTL_HOURS * 3_600_000 - 1_000);
    });
  });

  // ------------------------------------------------------------------ accept

  describe('accept', () => {
    function pendingInvitation(overrides: Record<string, unknown> = {}) {
      const invitation = HubInvitation.create({
        hubId: HUB,
        email: 'budi@kopi.id',
        role: 'manager',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 3_600_000),
        invitedBy: ADMIN,
        ...overrides,
      });
      mocks.invitationRepository.findByTokenHash.mockResolvedValue(invitation as any);
      return invitation;
    }

    it('adds the member with the invited role and spends the invitation', async () => {
      const invitation = pendingInvitation();

      const result = await service.accept('raw-token', USER);

      expect(mocks.membershipService.addMembership).toHaveBeenCalledWith(HUB, USER, 'manager');
      expect(result.created).toBe(true);
      expect(result.hubName).toBe('Group One');
      expect(invitation.serialize().status).toBe('accepted');
      expect(invitation.serialize().acceptedBy).toBe(USER);
      expect(invitation.serialize().acceptedAt).toBeInstanceOf(Date);
    });

    it('only ever uses the invitation row, never caller-supplied hub/role', async () => {
      pendingInvitation({ role: 'viewer' });
      await service.accept('raw-token', USER);
      expect(mocks.membershipService.addMembership).toHaveBeenCalledWith(HUB, USER, 'viewer');
    });

    it('looks the token up by digest, not by the raw value', async () => {
      pendingInvitation();
      await service.accept('raw-token', USER);
      expect(mocks.invitationRepository.findByTokenHash).toHaveBeenCalledWith(
        hashInvitationToken('raw-token'),
      );
    });

    it('DENIES a link opened by somebody other than the invited address', async () => {
      pendingInvitation();
      mocks.userRepository.findByIdRaw.mockResolvedValue(createUser(USER, 'mallory@kopi.id') as any);

      await expect(service.accept('raw-token', USER)).rejects.toThrow(/ditujukan ke budi@kopi.id/);
      expect(mocks.membershipService.addMembership).not.toHaveBeenCalled();
      // The invitation stays spendable for its real owner.
      expect(mocks.invitationRepository.save).not.toHaveBeenCalled();
    });

    it('DENIES an unknown token and a blank one', async () => {
      mocks.invitationRepository.findByTokenHash.mockResolvedValue(null);
      await expect(service.accept('nope', USER)).rejects.toThrow(/Undangan hub/);

      await expect(service.accept('   ', USER)).rejects.toThrow(/Token undangan wajib diisi/);
    });

    it('DENIES an expired invitation and stamps it as expired', async () => {
      const invitation = pendingInvitation({ expiresAt: new Date(Date.now() - 1_000) });

      await expect(service.accept('raw-token', USER)).rejects.toThrow(/kedaluwarsa/i);
      expect(invitation.serialize().status).toBe('expired');
      expect(mocks.membershipService.addMembership).not.toHaveBeenCalled();
    });

    it('DENIES a revoked and an already-accepted invitation', async () => {
      const revoked = pendingInvitation();
      revoked.revoke();
      await expect(service.accept('raw-token', USER)).rejects.toThrow(/dicabut/i);

      const accepted = pendingInvitation();
      accepted.accept('someone-else');
      await expect(service.accept('raw-token', USER)).rejects.toThrow(/sudah pernah diterima/i);
    });

    it('DENIES an invitation whose hub is archived', async () => {
      pendingInvitation();
      mocks.hubRepository.findById.mockResolvedValue(createHub('archived') as any);

      await expect(service.accept('raw-token', USER)).rejects.toThrow(/diarsipkan/i);
      expect(mocks.membershipService.addMembership).not.toHaveBeenCalled();
    });

    it('spends the invitation without creating a second membership when the admin added them meanwhile', async () => {
      const invitation = pendingInvitation();
      mocks.membershipService.findMembership.mockResolvedValue(createMembership({ role: 'admin' }) as any);

      const result = await service.accept('raw-token', USER);

      expect(mocks.membershipService.addMembership).not.toHaveBeenCalled();
      expect(result.created).toBe(false);
      expect(result.membership.role).toBe('admin');
      expect(invitation.serialize().status).toBe('accepted');
    });

    it('reactivates a suspended member on accept rather than failing as a duplicate', async () => {
      pendingInvitation();
      mocks.membershipService.findMembership.mockResolvedValue(null as any);
      mocks.membershipService.addMembership.mockResolvedValue(createMembership({ role: 'manager' }) as any);

      const result = await service.accept('raw-token', USER);

      expect(result.created).toBe(true);
      expect(mocks.membershipService.addMembership).toHaveBeenCalledWith(HUB, USER, 'manager');
    });
  });

  // ----------------------------------------------------------------- preview

  describe('preview', () => {
    it('reports whether the signed-in address matches the invitation', async () => {
      const invitation = HubInvitation.create({
        hubId: HUB,
        email: 'budi@kopi.id',
        role: 'manager',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 3_600_000),
        invitedBy: ADMIN,
      });
      mocks.invitationRepository.findByTokenHash.mockResolvedValue(invitation as any);

      const match = await service.preview('raw-token', USER);
      expect(match.emailMatches).toBe(true);
      expect(match.alreadyMember).toBe(false);
      expect(match.currentUserEmail).toBe('budi@kopi.id');
      expect(match.roleLabel).toMatch(/Manager/i);

      mocks.userRepository.findByIdRaw.mockResolvedValue(createUser(USER, 'lain@kopi.id') as any);
      const mismatch = await service.preview('raw-token', USER);
      expect(mismatch.emailMatches).toBe(false);
      expect(mismatch.currentUserEmail).toBe('lain@kopi.id');
    });

    it('surfaces an existing membership so the page can say "you are already in"', async () => {
      const invitation = HubInvitation.create({
        hubId: HUB,
        email: 'budi@kopi.id',
        role: 'manager',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 3_600_000),
        invitedBy: ADMIN,
      });
      mocks.invitationRepository.findByTokenHash.mockResolvedValue(invitation as any);
      mocks.membershipService.findMembership.mockResolvedValue(createMembership() as any);

      const preview = await service.preview('raw-token', USER);
      expect(preview.alreadyMember).toBe(true);
    });
  });

  // ------------------------------------------------------------------- list

  describe('listForHub', () => {
    it('stamps lapsed invitations and reports them as expired', async () => {
      const pending = HubInvitation.create({
        hubId: HUB,
        email: 'a@kopi.id',
        role: 'viewer',
        tokenHash: 'hash-a',
        expiresAt: new Date(Date.now() - 1_000),
        invitedBy: ADMIN,
      });
      mocks.invitationRepository.findByHub.mockResolvedValue([pending] as any);

      const rows = await service.listForHub(HUB);
      expect(rows[0].status).toBe('expired');
      expect(rows[0].isExpired).toBe(true);
      expect(mocks.invitationRepository.save).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------ revoke

  describe('revoke', () => {
    it('revokes a pending invitation of that hub', async () => {
      const invitation = HubInvitation.create({
        hubId: HUB,
        email: 'a@kopi.id',
        role: 'viewer',
        tokenHash: 'hash-a',
        expiresAt: new Date(Date.now() + 3_600_000),
        invitedBy: ADMIN,
      });
      mocks.invitationRepository.findById.mockResolvedValue(invitation as any);

      const revoked = await service.revoke(HUB, invitation.id.toValue());
      expect(revoked.status).toBe('revoked');
      expect(revoked.revokedAt).toBeInstanceOf(Date);
    });

    it('refuses to touch an invitation belonging to another hub', async () => {
      const invitation = HubInvitation.create({
        hubId: 'hub-other',
        email: 'a@kopi.id',
        role: 'viewer',
        tokenHash: 'hash-a',
        expiresAt: new Date(Date.now() + 3_600_000),
        invitedBy: ADMIN,
      });
      mocks.invitationRepository.findById.mockResolvedValue(invitation as any);

      await expect(service.revoke(HUB, invitation.id.toValue())).rejects.toThrow(/HubInvitation/);
      expect(invitation.serialize().status).toBe('pending');
    });

    it('refuses to revoke an invitation that is no longer pending', async () => {
      const invitation = HubInvitation.create({
        hubId: HUB,
        email: 'a@kopi.id',
        role: 'viewer',
        tokenHash: 'hash-a',
        expiresAt: new Date(Date.now() + 3_600_000),
        invitedBy: ADMIN,
      });
      invitation.revoke();
      mocks.invitationRepository.findById.mockResolvedValue(invitation as any);

      await expect(service.revoke(HUB, invitation.id.toValue())).rejects.toThrow(/tidak bisa dicabut/i);
    });
  });
});

describe('normalizeInvitationEmail', () => {
  it('is idempotent and case-insensitive', () => {
    expect(normalizeInvitationEmail(' <Budi@Kopi.ID> ')).toBe('budi@kopi.id');
    expect(normalizeInvitationEmail('budi@kopi.id')).toBe('budi@kopi.id');
  });
});
