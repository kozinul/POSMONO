import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../../src/core/identity/application/services/UserService';
import { User } from '../../src/core/identity/domain/User';
import { PasswordService } from '../../src/core/identity/domain/services/PasswordService';
import { NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';

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
  return {
    save: vi.fn(),
    delete: vi.fn(),
    findByEmail: vi.fn(),
    findByTenant: vi.fn(),
    findByIdAndTenant: vi.fn(),
  };
}

function createMockPasswordService(): PasswordService {
  return {
    hash: vi.fn(async (value: string) => `hashed-${value}`),
    compare: vi.fn(),
  } as unknown as PasswordService;
}

describe('UserService', () => {
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let passwordService: PasswordService;
  let service: UserService;

  beforeEach(() => {
    userRepo = createMockUserRepo();
    passwordService = createMockPasswordService();
    service = new UserService(userRepo, passwordService);
  });

  describe('create', () => {
    it('creates a user with hashed password and pin', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      const user = await service.create(TENANT_ID, {
        email: 'new@test.com',
        displayName: 'New User',
        roleId: 'role-manager',
        password: 'secret123',
        pin: '1234',
      });

      expect(userRepo.findByEmail).toHaveBeenCalledWith('new@test.com', TENANT_ID);
      expect(userRepo.save).toHaveBeenCalledTimes(1);
      expect(user.emailValue).toBe('new@test.com');
      expect(user.passwordHashValue).toBe('hashed-secret123');
      expect(user.pinValue).toBe('hashed-1234');
    });

    it('creates a user without pin', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      const user = await service.create(TENANT_ID, {
        email: 'cashier@test.com',
        displayName: 'Cashier',
        roleId: 'role-cashier',
        password: 'secret123',
      });

      expect(user.pinValue).toBeNull();
    });

    it('throws when email already exists', async () => {
      userRepo.findByEmail.mockResolvedValue(createUser());

      await expect(
        service.create(TENANT_ID, {
          email: 'new@test.com',
          displayName: 'New User',
          roleId: 'role-cashier',
          password: 'secret123',
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('throws when password is shorter than 6 characters', async () => {
      await expect(
        service.create(TENANT_ID, {
          email: 'new@test.com',
          displayName: 'New User',
          roleId: 'role-cashier',
          password: '12345',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('delete', () => {
    it('deletes an existing user of the tenant', async () => {
      userRepo.findByIdAndTenant.mockResolvedValue(createUser());

      await service.delete(TENANT_ID, 'user-1');

      expect(userRepo.findByIdAndTenant).toHaveBeenCalledWith('user-1', TENANT_ID);
      expect(userRepo.delete).toHaveBeenCalledTimes(1);
      expect(userRepo.delete.mock.calls[0][0].toValue()).toBe('user-1');
    });

    it('throws NotFound when user does not belong to tenant', async () => {
      userRepo.findByIdAndTenant.mockResolvedValue(null);

      await expect(service.delete(TENANT_ID, 'missing')).rejects.toBeInstanceOf(NotFoundError);
      expect(userRepo.delete).not.toHaveBeenCalled();
    });
  });
});
