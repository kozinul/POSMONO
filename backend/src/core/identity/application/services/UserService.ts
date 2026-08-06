import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { UserId } from '../../../../@shared/domain/Identifier';
import { User } from '../../domain/User';
import { PasswordService } from '../../domain/services/PasswordService';

export class UserService {
  constructor(
    private readonly userRepository: any,
    private readonly passwordService: PasswordService,
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
    data: { email: string; displayName: string; roleId: string; password: string; pin?: string | null; isActive?: boolean },
  ): Promise<User> {
    if (!data.password || data.password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }
    const existing = await this.userRepository.findByEmail(data.email, tenantId);
    if (existing) {
      throw new ValidationError('User with this email already exists');
    }

    const user = User.create({
      tenantId,
      email: data.email,
      passwordHash: await this.passwordService.hash(data.password),
      displayName: data.displayName,
      roleId: data.roleId,
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

  async update(tenantId: string, id: string, data: { displayName?: string; roleId?: string; password?: string; pin?: string | null; isActive?: boolean }): Promise<User> {
    const user = await this.getById(tenantId, id);

    const serialized = user.serialize();
    const updated = User.hydrate({
      ...serialized,
      displayName: data.displayName ?? serialized.displayName,
      roleId: data.roleId ?? serialized.roleId,
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
