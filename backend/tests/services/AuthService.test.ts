import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/core/identity/application/services/AuthService';
import { User } from '../../src/core/identity/domain/User';
import { PasswordService } from '../../src/core/identity/domain/services/PasswordService';
import { UnauthorizedError, ValidationError, ForbiddenError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';

function createUser(overrides = {}) {
  return User.create({
    tenantId: TENANT_ID,
    email: 'user@test.com',
    passwordHash: 'hashed-password',
    displayName: 'Test User',
    roleId: 'role-owner',
    isActive: true,
    lastLoginAt: null,
    preferences: {},
    ...overrides,
  });
}

function createMockUserRepo() {
  return { save: vi.fn(), findByEmail: vi.fn(), findByIdAndTenant: vi.fn() };
}

function createMockTokenService() {
  return {
    generateToken: vi.fn(() => 'access-token-123'),
    generateRefreshToken: vi.fn(() => 'refresh-token-123'),
    verifyToken: vi.fn(),
  };
}

function createMockSessionService() {
  return { create: vi.fn(), findByRefreshToken: vi.fn(), invalidate: vi.fn() };
}

function createMockPasswordService() {
  return { hash: vi.fn((pw: string) => `hashed-${pw}`), compare: vi.fn() };
}

describe('AuthService', () => {
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let tokenService: ReturnType<typeof createMockTokenService>;
  let passwordService: ReturnType<typeof createMockPasswordService>;
  let sessionService: ReturnType<typeof createMockSessionService>;
  let service: AuthService;

  beforeEach(() => {
    userRepo = createMockUserRepo();
    tokenService = createMockTokenService();
    passwordService = createMockPasswordService();
    sessionService = createMockSessionService();
    service = new AuthService(userRepo, tokenService, passwordService, sessionService);
  });

  describe('login', () => {
    it('returns tokens and user on valid credentials', async () => {
      const user = createUser();
      userRepo.findByEmail.mockResolvedValue(user);
      passwordService.compare.mockResolvedValue(true);

      const result = await service.execute({
        email: 'user@test.com',
        password: 'correct-password',
        tenantId: TENANT_ID,
      });

      expect(result.user).toBe(user);
      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-123');
    });

    it('throws UnauthorizedError for non-existent user', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(
        service.execute({ email: 'unknown@test.com', password: 'pw', tenantId: TENANT_ID }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for wrong password', async () => {
      const user = createUser();
      userRepo.findByEmail.mockResolvedValue(user);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.execute({ email: 'user@test.com', password: 'wrong', tenantId: TENANT_ID }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for inactive user', async () => {
      const user = createUser({ isActive: false });
      userRepo.findByEmail.mockResolvedValue(user);
      passwordService.compare.mockResolvedValue(true);

      await expect(
        service.execute({ email: 'user@test.com', password: 'pw', tenantId: TENANT_ID }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('does not reveal whether email or password was wrong', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      const noUserError = await service
        .execute({ email: 'x@x.com', password: 'pw', tenantId: TENANT_ID })
        .catch((e: Error) => e.message);

      passwordService.compare.mockResolvedValue(false);
      const user = createUser();
      userRepo.findByEmail.mockResolvedValue(user);

      const wrongPwError = await service
        .execute({ email: 'user@test.com', password: 'wrong', tenantId: TENANT_ID })
        .catch((e: Error) => e.message);

      expect(noUserError).toBe('Invalid credentials');
      expect(wrongPwError).toBe('Invalid credentials');
    });

    it('records login timestamp on successful auth', async () => {
      const user = createUser();
      userRepo.findByEmail.mockResolvedValue(user);
      passwordService.compare.mockResolvedValue(true);

      await service.execute({ email: 'user@test.com', password: 'pw', tenantId: TENANT_ID });

      expect(userRepo.save).toHaveBeenCalledTimes(1);
      expect(user.serialize().lastLoginAt).toBeInstanceOf(Date);
    });

    it('creates a session with refresh token', async () => {
      const user = createUser();
      userRepo.findByEmail.mockResolvedValue(user);
      passwordService.compare.mockResolvedValue(true);

      await service.execute({
        email: 'user@test.com',
        password: 'pw',
        tenantId: TENANT_ID,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      });

      expect(sessionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id.toValue(),
          tenantId: TENANT_ID,
          refreshToken: 'refresh-token-123',
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        }),
      );
    });

    it('resolves tenant from the globally unique email when tenant-scoped lookup misses', async () => {
      const user = createUser({ tenantId: 'tenant-acme' });
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByEmailGlobal = vi.fn().mockResolvedValue(user);
      passwordService.compare.mockResolvedValue(true);

      const result = await service.execute({
        email: 'user@test.com',
        password: 'pw',
        tenantId: 'dev-tenant',
        resolveByEmailGlobal: true,
      });

      expect(result.user.serialize().tenantId).toBe('tenant-acme');
      expect(sessionService.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-acme' }),
      );
    });

    it('still throws UnauthorizedError when global fallback finds no user', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByEmailGlobal = vi.fn().mockResolvedValue(null);

      await expect(
        service.execute({
          email: 'unknown@test.com',
          password: 'pw',
          tenantId: 'dev-tenant',
          resolveByEmailGlobal: true,
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('does not use global fallback when flagged off', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.findByEmailGlobal = vi.fn();

      await expect(
        service.execute({ email: 'user@test.com', password: 'pw', tenantId: TENANT_ID }),
      ).rejects.toThrow(UnauthorizedError);
      expect(userRepo.findByEmailGlobal).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('creates a new user', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      const user = await service.register({
        tenantId: TENANT_ID,
        email: 'new@test.com',
        password: 'password123',
        displayName: 'New User',
        roleId: 'role-cashier',
      });

      expect(user.serialize().email).toBe('new@test.com');
      expect(user.serialize().displayName).toBe('New User');
      expect(user.serialize().isActive).toBe(true);
      expect(passwordService.hash).toHaveBeenCalledWith('password123');
      expect(userRepo.save).toHaveBeenCalledTimes(1);
    });

    it('throws ValidationError if email already exists', async () => {
      const existing = createUser();
      userRepo.findByEmail.mockResolvedValue(existing);

      await expect(
        service.register({
          tenantId: TENANT_ID,
          email: 'user@test.com',
          password: 'pw',
          displayName: 'Dup',
          roleId: 'role-cashier',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('refresh', () => {
    it('returns new tokens for valid refresh token', async () => {
      tokenService.verifyToken.mockReturnValue({ sub: 'user-1', tenant: TENANT_ID, role: 'owner', type: 'refresh' });
      sessionService.findByRefreshToken.mockResolvedValue({ id: 'session-1' });
      tokenService.generateRefreshToken.mockReturnValue('new-refresh-123');
      tokenService.generateToken.mockReturnValue('new-access-123');

      const result = await service.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('new-access-123');
      expect(result.refreshToken).toBe('new-refresh-123');
      expect(sessionService.invalidate).toHaveBeenCalledWith('valid-refresh-token');
      expect(sessionService.create).toHaveBeenCalled();
    });

    it('throws UnauthorizedError for invalid token', async () => {
      tokenService.verifyToken.mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError if token type is not refresh', async () => {
      tokenService.verifyToken.mockReturnValue({ type: 'access', sub: 'u1', tenant: 't1', role: 'owner' });

      await expect(service.refresh('access-token')).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError if session not found', async () => {
      tokenService.verifyToken.mockReturnValue({ sub: 'user-1', tenant: TENANT_ID, role: 'owner', type: 'refresh' });
      sessionService.findByRefreshToken.mockResolvedValue(null);

      await expect(service.refresh('orphaned-token')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('logout', () => {
    it('invalidates the session', async () => {
      await service.logout('refresh-token-123');
      expect(sessionService.invalidate).toHaveBeenCalledWith('refresh-token-123');
    });
  });

  describe('getCurrentUser', () => {
    it('returns user by ID and tenant with role info', async () => {
      const user = createUser();
      userRepo.findByIdAndTenant.mockResolvedValue(user);

      const result = await service.getCurrentUser('user-1', TENANT_ID);
      expect(result).not.toBeNull();
      expect(result!.user).toBe(user);
      expect(result!.roleName).toBeNull();
      expect(result!.permissions).toEqual([]);
      expect(userRepo.findByIdAndTenant).toHaveBeenCalledWith('user-1', TENANT_ID);
    });
  });

  describe('cross-tenant hub membership (Fase 9)', () => {
    let userRepo: ReturnType<typeof createMockUserRepo>;
    let hubMembershipService: any;

    beforeEach(() => {
      userRepo = createMockUserRepo();
      hubMembershipService = {
        findAccessibleTenants: vi.fn(async () => [
          { tenantId: 'tenant-beta', tenantName: 'Beta Resto', hubId: 'hub-1', hubName: 'BCA Hospitality', role: 'admin' },
        ]),
        resolveRoleForTenant: vi.fn(async (_userId: string, tenantId: string) =>
          tenantId === 'tenant-beta' ? 'admin' : null,
        ),
      };
      const tokenService = createMockTokenService();
      const passwordService = createMockPasswordService();
      const sessionService = createMockSessionService();
      service = new AuthService(userRepo, tokenService, passwordService, sessionService, undefined, hubMembershipService);
      userRepo.findByIdRaw = vi.fn();
    });

    it('lists accessible tenants from hub memberships', async () => {
      const tenants = await service.listAccessibleTenants('user-1');
      expect(tenants).toHaveLength(1);
      expect(tenants[0]).toMatchObject({ tenantId: 'tenant-beta', role: 'admin' });
    });

    it('returns empty list when no membership service configured', async () => {
      const bare = new AuthService(
        createMockUserRepo() as any,
        createMockTokenService(),
        createMockPasswordService(),
        createMockSessionService(),
      );
      expect(await bare.listAccessibleTenants('user-1')).toEqual([]);
    });

    it('switchTenant issues tokens scoped to the target tenant with membership permissions', async () => {
      const user = createUser();
      userRepo.findByIdRaw.mockResolvedValue(user);

      const result = await service.switchTenant('user-1', 'tenant-beta', {
        userAgent: 'agent',
        ipAddress: '1.2.3.4',
      });

      expect(result.accessToken).toBe('access-token-123');
      expect(result.roleName).toBe('Hub Admin');
      expect(result.outletIds).toEqual([]);
      expect(result.accessibleTenants).toHaveLength(1);
      expect(result.user).toBe(user);
    });

    it('bakes tenant + role + permissions into the access token', async () => {
      const user = createUser();
      userRepo.findByIdRaw.mockResolvedValue(user);
      const tokenService = createMockTokenService();
      const sessionService = createMockSessionService();
      const membershipService = {
        findAccessibleTenants: vi.fn(async () => [
          { tenantId: 'tenant-beta', tenantName: 'Beta', hubId: 'hub-1', hubName: 'BCA', role: 'owner' },
        ]),
        resolveRoleForTenant: vi.fn(),
      };
      const svc = new AuthService(
        userRepo as any,
        tokenService,
        createMockPasswordService(),
        sessionService,
        undefined,
        membershipService,
      );

      await svc.switchTenant('user-1', 'tenant-beta');

      expect(tokenService.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: user.id.toValue(),
          tenant: 'tenant-beta',
          role: 'hub-owner',
          roleName: 'Hub Owner',
          outletIds: [],
          permissions: expect.arrayContaining(['reports:read', 'orders:read']),
        }),
      );
      expect(sessionService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id.toValue(), tenantId: 'tenant-beta' }),
      );
    });

    it('switchTenant rejects tenants outside the user memberships', async () => {
      const user = createUser();
      userRepo.findByIdRaw.mockResolvedValue(user);

      // Fase 17 reworded this from "No hub membership grants access" — the rule
      // is unchanged, only the vocabulary (access grants instead of membership).
      await expect(service.switchTenant('user-1', 'tenant-not-member')).rejects.toThrow(
        /No hub access grants entry to this tenant/,
      );
    });

    it('getCurrentUser falls back to hub-member context for cross-tenant sessions', async () => {
      const user = createUser();
      userRepo.findByIdAndTenant.mockResolvedValue(null);
      userRepo.findByIdRaw.mockResolvedValue(user);

      const result = await service.getCurrentUser('user-1', 'tenant-beta');
      expect(result).not.toBeNull();
      expect(result!.roleName).toBe('Hub Admin');
      expect(result!.permissions).toEqual(expect.arrayContaining(['reports:read']));
      expect(result!.outletIds).toEqual([]);
    });

    it('getCurrentUser returns null when neither tenant-scoped nor hub member', async () => {
      userRepo.findByIdAndTenant.mockResolvedValue(null);
      userRepo.findByIdRaw.mockResolvedValue(null);

      expect(await service.getCurrentUser('user-1', 'tenant-unknown')).toBeNull();
    });
  });
  // ------------------------------------------------ tenant status gate (2026-10-06)

  describe('tenant status gate', () => {
    const tenantRepo = { findById: vi.fn() };

    function fakeTenant(status: string) {
      return {
        isActive: () => status === 'active' || status === 'trial',
        serialize: () => ({ status }),
      };
    }

    function gatedService() {
      // Positional construction follows this file's convention; the gate is
      // the 8th (last) optional slot.
      return new AuthService(
        userRepo,
        tokenService,
        passwordService,
        sessionService,
        undefined,
        undefined,
        undefined,
        tenantRepo,
      );
    }

    function primeValidCredentials() {
      userRepo.findByEmail.mockResolvedValue(createUser());
      passwordService.compare.mockResolvedValue(true);
    }

    beforeEach(() => {
      tenantRepo.findById.mockReset();
    });

    it('DENY: blocked tenant yields an Indonesian reason and no token/session', async () => {
      primeValidCredentials();
      tenantRepo.findById.mockResolvedValue(fakeTenant('suspended'));

      const err = await gatedService()
        .execute({ email: 'user@test.com', password: 'pw', tenantId: TENANT_ID })
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as Error).message).toBe(
        'Tenant Anda berstatus ditangguhkan — akses dinonaktifkan. Hubungi pengelola.',
      );
      expect(tokenService.generateToken).not.toHaveBeenCalled();
      expect(sessionService.create).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it.each([
      ['frozen', 'dibekukan'],
      ['cancelled', 'dibatalkan'],
      ['deactivated', 'dinonaktifkan'],
    ])('DENY: %s tenant explains itself as "%s"', async (status, label) => {
      primeValidCredentials();
      tenantRepo.findById.mockResolvedValue(fakeTenant(status));

      const err = await gatedService()
        .execute({ email: 'user@test.com', password: 'pw', tenantId: TENANT_ID })
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as Error).message).toContain(label);
    });

    it.each(['active', 'trial'])('ALLOW: %s tenant still gets tokens', async (status) => {
      primeValidCredentials();
      tenantRepo.findById.mockResolvedValue(fakeTenant(status));

      const result = await gatedService().execute({
        email: 'user@test.com',
        password: 'pw',
        tenantId: TENANT_ID,
      });

      expect(result.accessToken).toBe('access-token-123');
      expect(sessionService.create).toHaveBeenCalledOnce();
    });

    it('ALLOW: a missing tenant document does not block (platform admin has no row)', async () => {
      primeValidCredentials();
      tenantRepo.findById.mockResolvedValue(null);

      const result = await gatedService().execute({
        email: 'user@test.com',
        password: 'pw',
        tenantId: TENANT_ID,
      });

      expect(result.accessToken).toBe('access-token-123');
    });

    it('does not reveal tenant state to a wrong-password attempt', async () => {
      userRepo.findByEmail.mockResolvedValue(createUser());
      passwordService.compare.mockResolvedValue(false);
      tenantRepo.findById.mockResolvedValue(fakeTenant('suspended'));

      await expect(
        gatedService().execute({ email: 'user@test.com', password: 'wrong', tenantId: TENANT_ID }),
      ).rejects.toThrow(UnauthorizedError);
      // The gate sits after password verification — no lookup, no oracle.
      expect(tenantRepo.findById).not.toHaveBeenCalled();
    });


  });
});
