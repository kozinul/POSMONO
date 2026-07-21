import { ConflictError, NotFoundError } from '../../../../@shared/infrastructure/error/AppError';
import { Family, IFamily } from '../../domain/Family';

interface CreateFamilyInput {
  tenantId: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

interface UpdateFamilyInput {
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export class FamilyService {
  constructor(private readonly familyRepository: any) {}

  async create(input: CreateFamilyInput): Promise<Family> {
    const family = Family.create({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description || '',
      sortOrder: input.sortOrder || 0,
      isActive: true,
    });

    await this.familyRepository.save(family);
    return family;
  }

  async update(id: string, tenantId: string, input: UpdateFamilyInput): Promise<Family> {
    const family = await this.familyRepository.findById(id);
    if (!family || family.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Family');
    }

    family.update(input);
    await this.familyRepository.save(family);
    return family;
  }

  async list(tenantId: string): Promise<Family[]> {
    return this.familyRepository.findByTenant(tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const family = await this.familyRepository.findById(id);
    if (!family || family.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Family');
    }
    await this.familyRepository.delete(id);
  }
}
