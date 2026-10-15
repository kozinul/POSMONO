import { ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import type { IProduct } from '../../domain/Product';
import type { MongoProductRepository } from '../../infrastructure/persistence/MongoProductRepository';
import type { MongoModifierRepository } from '../../infrastructure/persistence/MongoModifierRepository';
import type { MongoCategoryRepository } from '../../infrastructure/persistence/MongoCategoryRepository';
import { ModifierSelection, ModifierValidationService } from './ModifierValidationService';

export interface CatalogPriceItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  modifiers?: ModifierSelection[];
}

export type ResolvedCatalogItem<T extends CatalogPriceItem> = T & {
  unitPrice: number;
  totalPrice: number;
  modifiers: ModifierSelection[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function groupIdOf(group: unknown): string {
  if (!group) return '';
  const candidate = group as { id?: unknown; _id?: unknown; serialize?: () => unknown };
  if (typeof candidate.serialize === 'function') {
    const data = candidate.serialize() as { id?: string };
    return data?.id ?? '';
  }
  const id = candidate.id ?? candidate._id;
  return typeof id === 'string' ? id : '';
}

/**
 * Single source of truth for what an item costs.
 *
 * The client only decides *what* to order (product, quantity, modifier options);
 * the price always comes from the catalog, so a tampered request cannot underpay.
 */
export class CatalogItemResolver {
  private readonly validator: ModifierValidationService;

  constructor(
    private readonly productRepository: Pick<MongoProductRepository, 'findById'>,
    private readonly modifierRepository: Pick<
      MongoModifierRepository,
      'findByIds' | 'findByProduct' | 'findByFamily'
    >,
    private readonly categoryRepository?: Pick<MongoCategoryRepository, 'findById'>,
  ) {
    this.validator = new ModifierValidationService(modifierRepository);
  }

  async resolve<T extends CatalogPriceItem>(
    tenantId: string,
    items: T[],
  ): Promise<Array<ResolvedCatalogItem<T>>> {
    const products = new Map<string, IProduct>();

    for (const item of items) {
      if (products.has(item.productId)) continue;
      const product = await this.productRepository.findById(item.productId);
      const data = product?.serialize();
      // Foreign ids are reported as missing too, so product ids cannot be probed cross-tenant.
      if (!data || data.tenantId !== tenantId) {
        throw new ValidationError(`Produk tidak ditemukan: ${item.productId}`);
      }
      if (data.isActive === false) {
        throw new ValidationError(`Produk tidak aktif: ${data.name}`);
      }
      products.set(item.productId, data);
    }

    const resolvedItems: Array<ResolvedCatalogItem<T>> = [];
    for (const item of items) {
      const product = products.get(item.productId) as IProduct;
      const groupIds = await this.effectiveGroupIds(product);
      const { resolvedModifiers, totalAdjustment } = await this.validator.validateAndResolve(
        tenantId,
        groupIds,
        item.modifiers ?? [],
      );

      const unitPrice = round2(product.basePrice + totalAdjustment);
      resolvedItems.push({
        ...item,
        unitPrice,
        totalPrice: round2(unitPrice * item.quantity),
        modifiers: resolvedModifiers,
      });
    }

    return resolvedItems;
  }

  private async effectiveGroupIds(product: IProduct): Promise<string[]> {
    const ids = new Set<string>(product.modifierGroupIds || []);

    try {
      const productGroups = await this.modifierRepository.findByProduct(product.id);
      for (const group of productGroups) {
        const id = groupIdOf(group);
        if (id) ids.add(id);
      }
    } catch {
      // Catalog discovery is best-effort: an unavailable lookup must not block a sale.
    }

    if (this.categoryRepository && product.categoryId) {
      try {
        const category = await this.categoryRepository.findById(product.categoryId);
        const familyId = category?.serialize().familyId;
        if (familyId) {
          const familyGroups = await this.modifierRepository.findByFamily(familyId);
          for (const group of familyGroups) {
            const id = groupIdOf(group);
            if (id) ids.add(id);
          }
        }
      } catch {
        // Same as above.
      }
    }

    return Array.from(ids);
  }
}
