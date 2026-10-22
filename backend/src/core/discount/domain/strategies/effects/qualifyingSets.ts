import { IDiscountCondition } from '../conditions/ConditionStrategy';

export interface QualifyingItem {
  productId: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * The items a promotion targets: the qualifying items when a scope condition
 * (product / category match) narrows the cart, otherwise the whole cart.
 *
 * Effects that resolve a line from the cart ("the cheapest item") look the
 * line up in this pool, so the giveaway can never land on an item the
 * promotion does not cover. When a scope condition exists but nothing
 * qualifies, the pool stays empty on purpose: handing out an item the
 * promotion does not cover would discount the cart, while handing out nothing
 * only leaves the promotion unapplied.
 */
export function getQualifyingItems(
  conditions: IDiscountCondition[] | undefined,
  items: QualifyingItem[],
): QualifyingItem[] {
  let matchProductIds: string[] | null = null;
  let matchCategoryIds: string[] | null = null;

  for (const cond of conditions ?? []) {
    if (cond.type === 'product_match') {
      matchProductIds = (cond.config.productIds as string[]) ?? null;
    }
    if (cond.type === 'category_match') {
      matchCategoryIds = (cond.config.categoryIds as string[]) ?? null;
    }
  }

  if (matchProductIds && matchProductIds.length > 0) {
    return items.filter((i) => matchProductIds.includes(i.productId));
  }
  if (matchCategoryIds && matchCategoryIds.length > 0) {
    return items.filter((i) => matchCategoryIds.includes(i.categoryId));
  }
  return items;
}

export function countQualifyingSets(
  conditions: IDiscountCondition[] | undefined,
  items: QualifyingItem[],
): number {
  let minQty = 1;
  for (const cond of conditions ?? []) {
    if (cond.type === 'min_items') {
      const minItems = (cond.config.minItems as number) ?? 1;
      if (minItems > 0) minQty = minItems;
    }
  }

  const qualifying = getQualifyingItems(conditions, items);
  const totalQty = qualifying.reduce((s, i) => s + i.quantity, 0);
  return Math.floor(totalQty / minQty);
}
