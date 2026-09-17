import { ConflictError, NotFoundError } from '../../../../@shared/infrastructure/error/AppError';
import { Modifier, IModifier, IModifierOption, ModifierDisplayType } from '../../domain/Modifier';

interface CreateModifierInput {
  tenantId: string;
  productId?: string | null;
  familyId?: string | null;
  name: string;
  displayType?: ModifierDisplayType;
  minSelections?: number;
  maxSelections?: number;
  options?: IModifierOption[];
  required?: boolean;
  isActive?: boolean;
}

interface UpdateModifierInput {
  name?: string;
  options?: IModifierOption[];
  required?: boolean;
  isActive?: boolean;
  productId?: string | null;
  familyId?: string | null;
  displayType?: ModifierDisplayType;
  minSelections?: number;
  maxSelections?: number;
}

export class ModifierService {
  constructor(
    private readonly modifierRepository: any,
    private readonly productRepository?: any,
  ) {}

  async create(input: CreateModifierInput): Promise<Modifier> {
    const modifier = Modifier.create({
      tenantId: input.tenantId,
      productId: input.productId ?? null,
      familyId: input.familyId ?? null,
      name: input.name,
      displayType: input.displayType ?? 'radio',
      minSelections: input.minSelections ?? 0,
      maxSelections: input.maxSelections ?? 1,
      options: input.options || [],
      required: input.required ?? false,
      isActive: input.isActive ?? true,
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

  async listByTenant(tenantId: string): Promise<Modifier[]> {
    return this.modifierRepository.findByTenant(tenantId);
  }

  async listByProduct(productId: string): Promise<Modifier[]> {
    return this.modifierRepository.findByProduct(productId);
  }

  async listByProductGroups(productId: string): Promise<Modifier[]> {
    if (!this.productRepository) return [];
    const product = await this.productRepository.findById(productId);
    if (!product) return [];
    const groupIds: string[] = product.serialize().modifierGroupIds || [];
    if (groupIds.length === 0) return [];
    const groups: Modifier[] = await this.modifierRepository.findByIds(product.serialize().tenantId, groupIds);
    return groupIds
      .map((id) => groups.find((g) => g.serialize().id === id))
      .filter((g): g is Modifier => Boolean(g))
      .filter((g) => g.serialize().isActive);
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
