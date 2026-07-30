import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult, GeneratedLineItem } from './EffectStrategy';
import { allocateDiscount, AllocationType } from '../allocation';

export type BuyXGetYTargetType = 'cart_item' | 'product' | 'category' | 'same_product';

export interface BuyXGetYTarget {
  type: BuyXGetYTargetType;
  productId?: string;
  productName?: string;
  categoryId?: string;
  allocationStrategy?: AllocationType;
}

export class BuyXGetYEffect implements EffectStrategy {
  readonly type = 'buy_x_get_y' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const buyQuantity = (effect.config.buyQuantity as number) ?? 2;
    const getQuantity = (effect.config.getQuantity as number) ?? 1;
    const target = (effect.config.target as BuyXGetYTarget) ?? { type: 'cart_item', allocationStrategy: 'cheapest' };
    const matchItems = context.matchingItems ?? context.items;

    if (buyQuantity < 1 || getQuantity < 1) {
      return { discountAmount: 0, description: 'Buy X Get Y: invalid config' };
    }

    const totalQty = matchItems.reduce((s, i) => s + i.quantity, 0);
    if (totalQty < buyQuantity) {
      return { discountAmount: 0, description: 'Buy X Get Y: insufficient items' };
    }

    const qualifyingSets = Math.floor(totalQty / buyQuantity);
    const qualifiedQty = qualifyingSets * buyQuantity;
    const pickCount = qualifyingSets * getQuantity;

    const strategy = target.allocationStrategy ?? 'cheapest';
    const allocationItems = matchItems.map((i) => ({
      productId: i.productId,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    }));

    if (target.type === 'product' && target.productId) {
      const item = context.items.find((i) => i.productId === target.productId);
      const unitPrice = item?.unitPrice ?? 0;
      const generated: GeneratedLineItem = {
        productId: target.productId,
        productName: target.productName ?? '',
        categoryId: item?.categoryId ?? target.categoryId ?? '',
        quantity: pickCount,
        unitPrice,
      };
      return {
        discountAmount: 0,
        description: `Beli ${buyQuantity} dapat ${getQuantity} (${target.productName || target.productId} gratis x${qualifyingSets})`,
        generatedLineItems: [generated],
      };
    }

    if (target.type === 'category' && target.categoryId) {
      const catItems = context.items.filter((i) => i.categoryId === target.categoryId);
      if (catItems.length === 0) {
        return { discountAmount: 0, description: 'Buy X Get Y: no items in target category' };
      }
      const result = allocateDiscount(strategy, catItems.map((i) => ({
        productId: i.productId,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })), { pickCount, qualifiedQty, minQty: buyQuantity, freeCount: getQuantity });

      const freeItemsMap = new Map<string, number>();
      for (const item of result.selectedItems) {
        freeItemsMap.set(item.productId, (freeItemsMap.get(item.productId) || 0) + 1);
      }
      const freeItems = Array.from(freeItemsMap.entries()).map(([productId, quantity]) => ({
        productId, quantity,
      }));

      const label = strategy === 'cheapest' ? 'termurah' : strategy === 'most_expensive' ? 'termahal' : 'proporsional';
      return {
        discountAmount: 0,
        description: `Beli ${buyQuantity} dapat ${getQuantity} (${getQuantity} ${label} dari kategori x${qualifyingSets})`,
        freeItems,
      };
    }

    if (target.type === 'same_product') {
      const freeItemsMap = new Map<string, number>();
      for (const item of matchItems) {
        const sets = Math.floor(item.quantity / buyQuantity);
        if (sets > 0) {
          freeItemsMap.set(item.productId, (freeItemsMap.get(item.productId) || 0) + sets * getQuantity);
        }
      }
      if (freeItemsMap.size === 0) {
        return { discountAmount: 0, description: 'Buy X Get Y: insufficient items' };
      }
      const freeItems = Array.from(freeItemsMap.entries()).map(([productId, quantity]) => ({
        productId, quantity,
      }));
      return {
        discountAmount: 0,
        description: `Beli ${buyQuantity} dapat ${getQuantity} (produk sama x${qualifyingSets})`,
        freeItems,
      };
    }

    const result = allocateDiscount(strategy, allocationItems, {
      pickCount, qualifiedQty, minQty: buyQuantity, freeCount: getQuantity,
    });

    const freeItemsMap = new Map<string, number>();
    for (const item of result.selectedItems) {
      freeItemsMap.set(item.productId, (freeItemsMap.get(item.productId) || 0) + 1);
    }
    const freeItems = Array.from(freeItemsMap.entries()).map(([productId, quantity]) => ({
      productId, quantity,
    }));

    const label = strategy === 'cheapest' ? 'termurah' : strategy === 'most_expensive' ? 'termahal' : 'proporsional';
    return {
      discountAmount: 0,
      description: `Beli ${buyQuantity} dapat ${getQuantity} (${getQuantity} ${label} gratis x${qualifyingSets})`,
      freeItems,
    };
  }
}
