import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService, outletPolicyForRole, validateOutletIds } from '../../src/core/identity/application/services/UserService';
import { User } from '../../src/core/identity/domain/User';
import { Role } from '../../src/core/identity/domain/Role';
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

function createMockRoleRepo() {
  return {
    findById: vi.fn(),
  };
}

function roleNamed(name: string) {
  const role = Role.create({
    tenantId: TENANT_ID,
    name,
    description: '',
    permissions: [],
    isSystem: true,
  });
  return role;
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

  describe('outlet policy', () => {
    it('maps role names to policies', () => {
      expect(outletPolicyForRole('Owner')).toBe('all');
      expect(outletPolicyForRole('admin')).toBe('all');
      expect(outletPolicyForRole('Cashier')).toBe('single');
      expect(outletPolicyForRole('Manager')).toBe('multi');
      expect(outletPolicyForRole('Supervisor')).toBe('multi');
      expect(outletPolicyForRole(null)).toBe('multi');
    });

    it('validates outletIds against each policy', () => {
      expect(() => validateOutletIds([], 'all')).not.toThrow();
      expect(() => validateOutletIds(['o1'], 'all')).toThrow(ValidationError);
      expect(() => validateOutletIds([], 'single')).toThrow(ValidationError);
      expect(() => validateOutletIds(['o1', 'o2'], 'single')).toThrow(ValidationError);
      expect(() => validateOutletIds(['o1'], 'single')).not.toThrow();
      expect(() => validateOutletIds([], 'multi')).toThrow(ValidationError);
      expect(() => validateOutletIds(['o1'], 'multi')).not.toThrow();
    });
  });

  describe('create with outlet enforcement', () => {
    let roleRepo: ReturnType<typeof createMockRoleRepo>;
    let enforced: UserService;

    beforeEach(() => {
      roleRepo = createMockRoleRepo();
      enforced = new UserService(userRepo, passwordService, roleRepo);
      userRepo.findByEmail.mockResolvedValue(null);
    });

    it('rejects cashier without exactly one outlet', async () => {
      roleRepo.findById.mockResolvedValue(roleNamed('Cashier'));

      await expect(
        enforced.create(TENANT_ID, {
          email: 'k@test.com',
          displayName: 'Kasir',
          roleId: 'r-cashier',
          password: 'secret123',
          outletIds: [],
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('rejects owner with explicit outlets', async () => {
      roleRepo.findById.mockResolvedValue(roleNamed('Owner'));

      await expect(
        enforced.create(TENANT_ID, {
          email: 'o@test.com',
          displayName: 'Owner',
          roleId: 'r-owner',
          password: 'secret123',
          outletIds: ['o1'],
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('accepts manager with at least one outlet and deduplicates', async () => {
      roleRepo.findById.mockResolvedValue(roleNamed('Manager'));

      const user = await enforced.create(TENANT_ID, {
        email: 'm@test.com',
        displayName: 'Manager',
        roleId: 'r-manager',
        password: 'secret123',
        outletIds: ['o1', 'o1', 'o2'],
      });

      expect(user.outletIdsValue).toEqual(['o1', 'o2']);
      expect(userRepo.save).toHaveBeenCalledTimes(1);
    });

    it('skips validation when no roleRepository is provided', async () => {
      const user = await service.create(TENANT_ID, {
        email: 'x@test.com',
        displayName: 'X',
        roleId: 'r-any',
        password: 'secret123',
        outletIds: [],
      });

      expect(user.outletIdsValue).toEqual([]);
    });
  });

  describe('update with outlet enforcement', () => {
    let roleRepo: ReturnType<typeof createMockRoleRepo>;
    let enforced: UserService;

    beforeEach(() => {
      roleRepo = createMockRoleRepo();
      enforced = new UserService(userRepo, passwordService, roleRepo);
      userRepo.findByIdAndTenant.mockResolvedValue(createUser({ roleId: 'role-manager', outletIds: ['o1'] }));
    });

    it('rejects switching role to cashier without exactly one outlet', async () => {
      roleRepo.findById.mockResolvedValue(roleNamed('Cashier'));

      await expect(
        enforced.update(TENANT_ID, 'user-1', { roleId: 'role-cashier', outletIds: [] }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('persists outletIds on role change for multi-outlet role', async () => {
      roleRepo.findById.mockResolvedValue(roleNamed('Supervisor'));

      const user = await enforced.update(TENANT_ID, 'user-1', {
        roleId: 'role-supervisor',
        outletIds: ['o1', 'o2'],
      });

      expect(user.outletIdsValue).toEqual(['o1', 'o2']);
      expect(userRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});
