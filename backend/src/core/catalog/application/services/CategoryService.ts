import { ConflictError, NotFoundError } from '../../../../@shared/infrastructure/error/AppError';
import { Category, ICategory } from '../../domain/Category';

interface CreateCategoryInput {
  tenantId: string;
  name: string;
  parentId?: string;
  sortOrder?: number;
}

interface UpdateCategoryInput {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export class CategoryService {
  constructor(private readonly categoryRepository: any) {}

  async create(input: CreateCategoryInput): Promise<Category> {
    const category = Category.create({
      tenantId: input.tenantId,
      name: input.name,
      parentId: input.parentId || null,
      sortOrder: input.sortOrder || 0,
      isActive: true,
    });

    await this.categoryRepository.save(category);
    return category;
  }

  async update(id: string, tenantId: string, input: UpdateCategoryInput): Promise<Category> {
    const category = await this.categoryRepository.findById(id);
    if (!category || category.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Category');
    }

    category.update(input);
    await this.categoryRepository.save(category);
    return category;
  }

  async list(tenantId: string): Promise<Category[]> {
    return this.categoryRepository.findByTenant(tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const category = await this.categoryRepository.findById(id);
    if (!category || category.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Category');
    }
    await this.categoryRepository.delete(id);
  }
}
