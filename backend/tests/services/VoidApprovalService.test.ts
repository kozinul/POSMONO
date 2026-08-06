import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoidApprovalService } from '../../src/core/ordering/application/services/VoidApprovalService';
import { User } from '../../src/core/identity/domain/User';
import { Role } from '../../src/core/identity/domain/Role';
import { ForbiddenError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';
const CASHIER_ID = 'user-cashier';
const MANAGER_ID = 'user-manager';

function createUser(overrides: Record<string, unknown> = {}) {
  return User.create({
    tenantId: TENANT_ID,
    email: 'user@test.com',
    passwordHash: 'hashed-password',
    displayName: 'Test User',
    roleId: 'role-1',
    isActive: true,
    lastLoginAt: null,
    pin: null,
    preferences: {},
    ...overrides,
  });
}

function createRole(overrides: Record<string, unknown> = {}) {
  return Role.create({
    tenantId: TENANT_ID,
    name: 'role',
    description: '',
    permissions: [],
    isSystem: false,
    ...overrides,
  });
}

function createMockUserRepo() {
  return { findByIdAndTenant: vi.fn(), findByTenant: vi.fn() };
}

function createMockRoleRepo() {
  return { findById: vi.fn() };
}

function createMockPasswordService() {
  return { compare: vi.fn() };
}

describe('VoidApprovalService', () => {
  let userRepo: ReturnType<typeof createMockUserRepo>;
  let roleRepo: ReturnType<typeof createMockRoleRepo>;
  let passwordService: ReturnType<typeof createMockPasswordService>;
  let service: VoidApprovalService;

  beforeEach(() => {
    userRepo = createMockUserRepo();
    roleRepo = createMockRoleRepo();
    passwordService = createMockPasswordService();
    service = new VoidApprovalService(userRepo, roleRepo, passwordService);
  });

  it('bypasses approval when caller has order:void permission (no PIN)', async () => {
    const caller = createUser({ displayName: 'Manager One', roleId: 'role-manager' });
    userRepo.findByIdAndTenant.mockResolvedValue(caller);
    roleRepo.findById.mockResolvedValue(createRole({ permissions: ['order:void'] }));

    const result = await service.verifyApprover({
      tenantId: TENANT_ID,
      userId: MANAGER_ID,
      requiredPermission: 'order:void',
    });

    expect(result.requireApproval).toBe(false);
    expect(result.approverId).toBe(caller.id.toValue());
    expect(result.approverName).toBe('Manager One');
  });

  it('throws ForbiddenError when cashier provides no managerPin', async () => {
    const caller = createUser({ displayName: 'Cashier One', roleId: 'role-cashier' });
    userRepo.findByIdAndTenant.mockResolvedValue(caller);
    roleRepo.findById.mockResolvedValue(createRole({ permissions: [] }));

    await expect(
      service.verifyApprover({
        tenantId: TENANT_ID,
        userId: CASHIER_ID,
        requiredPermission: 'order:void',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when cashier provides a wrong managerPin', async () => {
    const caller = createUser({ displayName: 'Cashier One', roleId: 'role-cashier' });
    const manager = createUser({
      email: 'manager@test.com',
      displayName: 'Manager One',
      roleId: 'role-manager',
      pin: 'hashed-pin',
    });
    userRepo.findByIdAndTenant.mockResolvedValue(caller);
    userRepo.findByTenant.mockResolvedValue([caller, manager]);
    roleRepo.findById.mockImplementation(async (id: string) =>
      createRole({
        permissions: id === 'role-manager' ? ['order:void'] : [],
      }),
    );
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.verifyApprover({
        tenantId: TENANT_ID,
        userId: CASHIER_ID,
        managerPin: '0000',
        requiredPermission: 'order:void',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('resolves approver when cashier provides a correct managerPin', async () => {
    const caller = createUser({ displayName: 'Cashier One', roleId: 'role-cashier' });
    const manager = createUser({
      email: 'manager@test.com',
      displayName: 'Manager One',
      roleId: 'role-manager',
      pin: 'hashed-pin',
    });
    userRepo.findByIdAndTenant.mockResolvedValue(caller);
    userRepo.findByTenant.mockResolvedValue([caller, manager]);
    roleRepo.findById.mockImplementation(async (id: string) =>
      createRole({
        permissions: id === 'role-manager' ? ['order:void'] : [],
      }),
    );
    passwordService.compare.mockResolvedValue(true);

    const result = await service.verifyApprover({
      tenantId: TENANT_ID,
      userId: CASHIER_ID,
      managerPin: '1234',
      requiredPermission: 'order:void',
    });

    expect(result.requireApproval).toBe(true);
    expect(result.approverId).toBe(manager.id.toValue());
    expect(result.approverName).toBe('Manager One');
  });

  it('ignores a user whose PIN matches but lacks the required permission', async () => {
    const caller = createUser({ displayName: 'Cashier One', roleId: 'role-cashier' });
    const staffWithPin = createUser({
      email: 'staff@test.com',
      displayName: 'Staff One',
      roleId: 'role-staff',
      pin: 'hashed-pin',
    });
    userRepo.findByIdAndTenant.mockResolvedValue(caller);
    userRepo.findByTenant.mockResolvedValue([caller, staffWithPin]);
    roleRepo.findById.mockResolvedValue(createRole({ permissions: [] }));
    passwordService.compare.mockResolvedValue(true);

    await expect(
      service.verifyApprover({
        tenantId: TENANT_ID,
        userId: CASHIER_ID,
        managerPin: '1234',
        requiredPermission: 'order:void',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when caller user does not exist', async () => {
    userRepo.findByIdAndTenant.mockResolvedValue(null);

    await expect(
      service.verifyApprover({
        tenantId: TENANT_ID,
        userId: 'unknown',
        requiredPermission: 'order:void',
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
