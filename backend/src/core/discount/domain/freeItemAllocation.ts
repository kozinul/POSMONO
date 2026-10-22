/**
 * Allocation of free units to the cart lines they come from.
 *
 * A product can sit in the cart more than once (same product, different
 * modifiers → different unit prices). A promotion that gives a unit away has
 * to say *which* unit: the cheapest one, otherwise the customer walks away
 * with the expensive variant for free.
 *
 * The discount engine (to price the giveaway) and the pricing service (to
 * split the receipt lines) both use this helper, so the quoted amount and the
 * receipt can never disagree about which unit was given away.
 */

export interface FreeUnitCartLine {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface FreeUnitAllocation {
  /** Index of the cart line the free units are taken from. */
  lineIndex: number;
  productId: string;
  quantity: number;
  unitPrice: number;
  /** quantity × unitPrice — the amount the giveaway is worth. */
  value: number;
}

/**
 * Distributes the free quantity of every product over the cart lines of that
 * product, cheapest line first.
 *
 * @param items               cart lines in cart order
 * @param freeQuantityByProduct free units per product id
 */
export function allocateFreeUnits(
  items: FreeUnitCartLine[],
  freeQuantityByProduct: Map<string, number>,
): FreeUnitAllocation[] {
  const lineIndexesByProduct = new Map<string, number[]>();
  items.forEach((item, index) => {
    const indexes = lineIndexesByProduct.get(item.productId) ?? [];
    indexes.push(index);
    lineIndexesByProduct.set(item.productId, indexes);
  });

  const allocations: FreeUnitAllocation[] = [];

  for (const [productId, requested] of freeQuantityByProduct) {
    let left = requested;
    const indexes = [...(lineIndexesByProduct.get(productId) ?? [])].sort(
      (a, b) => items[a].unitPrice - items[b].unitPrice,
    );
    for (const index of indexes) {
      if (left <= 0) break;
      const take = Math.min(left, items[index].quantity);
      if (take <= 0) continue;
      allocations.push({
        lineIndex: index,
        productId,
        quantity: take,
        unitPrice: items[index].unitPrice,
        value: take * items[index].unitPrice,
      });
      left -= take;
    }
  }

  return allocations;
}

/** Total value of a set of allocations. */
export function sumFreeUnitValue(allocations: FreeUnitAllocation[]): number {
  return allocations.reduce((sum, a) => sum + a.value, 0);
}
