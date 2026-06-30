import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/core/identity/application/services/AuthService';
import { User } from '../../src/core/identity/domain/User';
import { PasswordService } from '../../src/core/identity/domain/services/PasswordService';
import { UnauthorizedError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';

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
    it('returns user by ID and tenant', async () => {
      const user = createUser();
      userRepo.findByIdAndTenant.mockResolvedValue(user);

      const result = await service.getCurrentUser('user-1', TENANT_ID);
      expect(result).toBe(user);
      expect(userRepo.findByIdAndTenant).toHaveBeenCalledWith('user-1', TENANT_ID);
    });
  });
});
