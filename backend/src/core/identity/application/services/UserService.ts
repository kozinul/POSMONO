import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { UserId } from '../../../../@shared/domain/Identifier';
import { User } from '../../domain/User';
import { PasswordService } from '../../domain/services/PasswordService';

/**
 * Outlet policy per role name (case-insensitive):
 * - owner / admin  → `[]` (all outlets of the tenant)
 * - cashier        → exactly 1 outlet
 * - any other role (manager, supervisor, custom) → at least 1 outlet
 */
export type OutletPolicy = 'all' | 'single' | 'multi';

export function outletPolicyForRole(roleName: string | null | undefined): OutletPolicy {
  const n = (roleName ?? '').toLowerCase().trim();
  if (n === 'owner' || n === 'admin') return 'all';
  if (n === 'cashier') return 'single';
  return 'multi';
}

export function validateOutletIds(outletIds: string[], policy: OutletPolicy): void {
  const ids = Array.from(new Set(outletIds ?? []));
  if (policy === 'all') {
    if (ids.length > 0) {
      throw new ValidationError('Role owner/admin mencakup semua outlet — outletIds harus kosong');
    }
    return;
  }
  if (policy === 'single' && ids.length !== 1) {
    throw new ValidationError('Role kasir harus tepat memiliki 1 outlet');
  }
  if (policy === 'multi' && ids.length === 0) {
    throw new ValidationError('Role ini harus memiliki minimal 1 outlet');
  }
}

export class UserService {
  constructor(
    private readonly userRepository: any,
    private readonly passwordService: PasswordService,
    private readonly roleRepository?: any,
  ) {}

  async list(tenantId: string): Promise<User[]> {
    return this.userRepository.findByTenant(tenantId);
  }

  async getById(tenantId: string, id: string): Promise<User> {
    const user = await this.userRepository.findByIdAndTenant(id, tenantId);
    if (!user) {
      throw new NotFoundError('User', id);
    }
    return user;
  }

  async create(
    tenantId: string,
    data: { email: string; displayName: string; roleId: string; password: string; pin?: string | null; isActive?: boolean; outletIds?: string[] },
  ): Promise<User> {
    if (!data.password || data.password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }
    const existing = await this.userRepository.findByEmail(data.email, tenantId);
    if (existing) {
      throw new ValidationError('User with this email already exists');
    }

    const outletIds = Array.from(new Set(data.outletIds ?? []));
    await this.assertOutletPolicy(data.roleId, outletIds);

    const user = User.create({
      tenantId,
      email: data.email,
      passwordHash: await this.passwordService.hash(data.password),
      displayName: data.displayName,
      roleId: data.roleId,
      outletIds,
      isActive: data.isActive ?? true,
      lastLoginAt: null,
      pin: data.pin ? await this.passwordService.hash(data.pin) : null,
      preferences: {},
    });

    await this.userRepository.save(user);
    return user;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.getById(tenantId, id);
    await this.userRepository.delete(new UserId(id));
  }

  async update(tenantId: string, id: string, data: { displayName?: string; roleId?: string; password?: string; pin?: string | null; isActive?: boolean; outletIds?: string[] }): Promise<User> {
    const user = await this.getById(tenantId, id);

    const serialized = user.serialize();
    const nextRoleId = data.roleId ?? serialized.roleId;
    const nextOutletIds = data.outletIds !== undefined
      ? Array.from(new Set(data.outletIds))
      : serialized.outletIds;

    await this.assertOutletPolicy(nextRoleId, nextOutletIds);

    const updated = User.hydrate({
      ...serialized,
      displayName: data.displayName ?? serialized.displayName,
      roleId: nextRoleId,
      outletIds: nextOutletIds,
      isActive: data.isActive ?? serialized.isActive,
      passwordHash: data.password
        ? await this.passwordService.hash(data.password)
        : serialized.passwordHash,
      pin: data.pin === undefined
        ? serialized.pin
        : data.pin === null
          ? null
          : await this.passwordService.hash(data.pin),
    });

    await this.userRepository.save(updated);
    return updated;
  }

  private async assertOutletPolicy(roleId: string, outletIds: string[]): Promise<void> {
    if (!this.roleRepository) return;

    const role = await this.roleRepository.findById(roleId);
    if (!role) return;

    const policy = outletPolicyForRole(role.serialize()?.name);
    validateOutletIds(outletIds, policy);
  }

  async deactivate(tenantId: string, id: string): Promise<User> {
    const user = await this.getById(tenantId, id);
    user.deactivate();
    await this.userRepository.save(user);
    return user;
  }

  async activate(tenantId: string, id: string): Promise<User> {
    const user = await this.getById(tenantId, id);
    user.activate();
    await this.userRepository.save(user);
    return user;
  }
}
