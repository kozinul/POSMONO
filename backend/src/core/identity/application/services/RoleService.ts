import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Role } from '../../domain/Role';

export class RoleService {
  constructor(
    private readonly roleRepository: any,
  ) {}

  async create(input: { tenantId: string; name: string; description?: string; permissions?: string[] }): Promise<Role> {
    const existing = await this.roleRepository.findByName(input.tenantId, input.name);
    if (existing) {
      throw new ValidationError(`Role "${input.name}" already exists`);
    }

    const role = Role.create({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description || '',
      permissions: input.permissions || [],
      isSystem: false,
    });

    await this.roleRepository.save(role);
    return role;
  }

  async getById(tenantId: string, id: string): Promise<Role> {
    const role = await this.roleRepository.findById(id);
    if (!role || role.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Role', id);
    }
    return role;
  }

  async list(tenantId: string): Promise<Role[]> {
    return this.roleRepository.findByTenant(tenantId);
  }

  async update(tenantId: string, id: string, data: { name?: string; description?: string; permissions?: string[] }): Promise<Role> {
    const role = await this.getById(tenantId, id);
    const serialized = role.serialize();

    if (serialized.isSystem) {
      throw new ValidationError('Cannot modify system role');
    }

    if (data.name !== undefined) {
      const existing = await this.roleRepository.findByName(tenantId, data.name);
      if (existing && existing.id.toValue() !== id) {
        throw new ValidationError(`Role "${data.name}" already exists`);
      }
    }

    const updated = Role.hydrate({
      ...serialized,
      name: data.name ?? serialized.name,
      description: data.description ?? serialized.description,
      permissions: data.permissions ?? serialized.permissions,
    });

    await this.roleRepository.save(updated);
    return updated;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const role = await this.getById(tenantId, id);
    if (role.serialize().isSystem) {
      throw new ValidationError('Cannot delete system role');
    }
    await this.roleRepository.delete(id);
  }
}
