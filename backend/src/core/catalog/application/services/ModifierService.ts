import { ConflictError, NotFoundError } from '../../../../@shared/infrastructure/error/AppError';
import { Modifier, IModifier, IModifierOption } from '../../domain/Modifier';

interface CreateModifierInput {
  tenantId: string;
  productId?: string;
  familyId?: string;
  name: string;
  options?: IModifierOption[];
  required?: boolean;
}

interface UpdateModifierInput {
  name?: string;
  options?: IModifierOption[];
  required?: boolean;
  isActive?: boolean;
  productId?: string | null;
  familyId?: string | null;
}

export class ModifierService {
  constructor(private readonly modifierRepository: any) {}

  async create(input: CreateModifierInput): Promise<Modifier> {
    const modifier = Modifier.create({
      tenantId: input.tenantId,
      productId: input.productId || null,
      familyId: input.familyId || null,
      name: input.name,
      options: input.options || [],
      required: input.required || false,
      isActive: true,
    });

    await this.modifierRepository.save(modifier);
    return modifier;
  }

  async update(id: string, tenantId: string, input: UpdateModifierInput): Promise<Modifier> {
    const modifier = await this.modifierRepository.findById(id);
    if (!modifier || modifier.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Modifier');
    }

    modifier.update(input);
    await this.modifierRepository.save(modifier);
    return modifier;
  }

  async list(tenantId: string): Promise<Modifier[]> {
    return this.modifierRepository.findByTenant(tenantId);
  }

  async listByProduct(productId: string): Promise<Modifier[]> {
    return this.modifierRepository.findByProduct(productId);
  }

  async listByFamily(familyId: string): Promise<Modifier[]> {
    return this.modifierRepository.findByFamily(familyId);
  }

  async listGlobal(tenantId: string): Promise<Modifier[]> {
    return this.modifierRepository.findGlobal(tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const modifier = await this.modifierRepository.findById(id);
    if (!modifier || modifier.serialize().tenantId !== tenantId) {
      throw new NotFoundError('Modifier');
    }
    await this.modifierRepository.delete(id);
  }
}
