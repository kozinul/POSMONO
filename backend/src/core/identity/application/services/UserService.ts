import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
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

  async update(tenantId: string, id: string, data: { displayName?: string; roleId?: string; password?: string; isActive?: boolean }): Promise<User> {
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
