import { ValidationError } from '../../../../@shared/infrastructure/error/AppError';

export interface ModifierSelection {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceAdjustment: number;
}

export interface ModifierGroupDoc {
  id: string;
  tenantId: string;
  name: string;
  displayType: string;
  minSelections: number;
  maxSelections: number;
  required: boolean;
  options: Array<{
    id: string;
    name: string;
    priceAdjustment: number;
    isActive: boolean;
  }>;
}

export class ModifierValidationService {
  constructor(private readonly modifierRepository: any) {}

  async validateAndResolve(
    tenantId: string,
    productModifierGroupIds: string[],
    clientModifiers: ModifierSelection[],
  ): Promise<{ resolvedModifiers: ModifierSelection[]; totalAdjustment: number }> {
    if (!clientModifiers || clientModifiers.length === 0) {
      if (productModifierGroupIds.length === 0) {
        return { resolvedModifiers: [], totalAdjustment: 0 };
      }
      const requiredGroups = await this.getRequiredGroups(tenantId, productModifierGroupIds);
      if (requiredGroups.length > 0) {
        throw new ValidationError(
          `Modifier wajib belum dipilih: ${requiredGroups.map((g) => g.name).join(', ')}`,
        );
      }
      return { resolvedModifiers: [], totalAdjustment: 0 };
    }

    const clientGroupIds = new Set(clientModifiers.map((m) => m.groupId));

    // Validate each selected modifier group exists for this tenant.
    // The explicit product/family/global check is performed by the repository or frontend,
    // here we ensure the groups provided by the client are valid and active for the tenant.
    const groups = await this.modifierRepository.findByIds(
      tenantId,
      Array.from(clientGroupIds),
    );

    const groupMap = new Map<string, ModifierGroupDoc>();
    for (const g of groups) {
      const data = (g as any).serialize ? (g as any).serialize() : g;
      groupMap.set(data.id, data as ModifierGroupDoc);
    }

    for (const groupId of clientGroupIds) {
      if (!groupMap.has(groupId)) {
        throw new ValidationError(
          `Modifier group tidak ditemukan atau tidak tersedia: ${groupId}`,
        );
      }
    }

    const resolvedModifiers: ModifierSelection[] = [];
    let totalAdjustment = 0;

    const selectionsByGroup = new Map<string, ModifierSelection[]>();
    for (const sel of clientModifiers) {
      const existing = selectionsByGroup.get(sel.groupId) || [];
      existing.push(sel);
      selectionsByGroup.set(sel.groupId, existing);
    }

    for (const groupId of productModifierGroupIds) {
      const group = groupMap.get(groupId);
      if (!group) continue;

      const selections = selectionsByGroup.get(groupId) || [];

      if (group.required && selections.length < group.minSelections) {
        throw new ValidationError(
          `Modifier "${group.name}" wajib dipilih minimal ${group.minSelections} opsi`,
        );
      }

      if (selections.length > group.maxSelections) {
        throw new ValidationError(
          `Modifier "${group.name}" maksimal ${group.maxSelections} opsi`,
        );
      }

      for (const sel of selections) {
        const validOption = group.options.find(
          (o) => o.id === sel.optionId && o.isActive,
        );
        if (!validOption) {
          throw new ValidationError(
            `Opsi modifier "${sel.optionName}" tidak valid untuk grup "${group.name}"`,
          );
        }

        const resolved: ModifierSelection = {
          groupId: group.id,
          groupName: group.name,
          optionId: validOption.id,
          optionName: validOption.name,
          priceAdjustment: validOption.priceAdjustment,
        };

        resolvedModifiers.push(resolved);
        totalAdjustment += validOption.priceAdjustment;
      }
    }

    return { resolvedModifiers, totalAdjustment };
  }

  private async getRequiredGroups(
    tenantId: string,
    groupIds: string[],
  ): Promise<ModifierGroupDoc[]> {
    const groups = await this.modifierRepository.findByIds(tenantId, groupIds);
    const normalized = groups.map((g: any) => (g.serialize ? g.serialize() : g));
    return normalized.filter((g: ModifierGroupDoc) => g.required && g.minSelections > 0);
  }
}
