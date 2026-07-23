import { ConflictError, NotFoundError } from '../../../../@shared/infrastructure/error/AppError';
import { MenuType } from '../../domain/MenuType';

interface CreateMenuTypeInput {
  tenantId: string;
  name: string;
  sortOrder?: number;
}

interface UpdateMenuTypeInput {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export class MenuTypeService {
  constructor(
    private readonly menuTypeRepository: any,
    private readonly familyRepository: any,
  ) {}

  async create(input: CreateMenuTypeInput): Promise<MenuType> {
    const existing = await this.menuTypeRepository.findByName(input.tenantId, input.name);
    if (existing) {
      throw new ConflictError(`Menu type "${input.name}" already exists`);
    }

    const menuType = MenuType.create({
      tenantId: input.tenantId,
      name: input.name,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
    });

    await this.menuTypeRepository.save(menuType);
    return menuType;
  }

  async list(tenantId: string): Promise<MenuType[]> {
    return this.menuTypeRepository.findByTenant(tenantId);
  }

  async update(id: string, tenantId: string, input: UpdateMenuTypeInput): Promise<MenuType> {
    const menuType = await this.menuTypeRepository.findById(id);
    if (!menuType || menuType.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Menu type');
    }

    if (input.name && input.name !== menuType.serialize().name) {
      const existing = await this.menuTypeRepository.findByName(tenantId, input.name);
      if (existing) {
        throw new ConflictError(`Menu type "${input.name}" already exists`);
      }
    }

    menuType.update(input);
    await this.menuTypeRepository.save(menuType);
    return menuType;
  }

  async rename(id: string, tenantId: string, newName: string): Promise<MenuType> {
    const menuType = await this.menuTypeRepository.findById(id);
    if (!menuType || menuType.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Menu type');
    }

    if (newName !== menuType.serialize().name) {
      const existing = await this.menuTypeRepository.findByName(tenantId, newName);
      if (existing) {
        throw new ConflictError(`Menu type "${newName}" already exists`);
      }
    }

    const oldName = menuType.serialize().name;
    menuType.update({ name: newName });
    await this.menuTypeRepository.save(menuType);

    await this.familyRepository.updateMenuTypeBulk(tenantId, oldName, newName);

    return menuType;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const menuType = await this.menuTypeRepository.findById(id);
    if (!menuType || menuType.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Menu type');
    }

    const familiesUsing = await this.familyRepository.findByMenuType(tenantId, menuType.serialize().name);
    if (familiesUsing.length > 0) {
      throw new ConflictError(`Cannot delete: ${familiesUsing.length} family(ies) still use this menu type`);
    }

    await this.menuTypeRepository.delete(id);
  }
}
