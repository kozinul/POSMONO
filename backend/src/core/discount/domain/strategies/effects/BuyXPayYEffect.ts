import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';
import { allocateDiscount, describeAllocation, AllocationType } from '../allocation';

export class BuyXPayYEffect implements EffectStrategy {
  readonly type = 'buy_x_pay_y' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const minQty = (effect.config.minQty as number) ?? 1;
    const payQty = (effect.config.payQty as number) ?? 0;
    const strategy = (effect.config.allocationStrategy as AllocationType) ?? 'cheapest';
    const matchItems = context.matchingItems ?? context.items;

    if (minQty <= payQty) return { discountAmount: 0, description: 'Buy X Pay Y: invalid config' };

    const freeCount = minQty - payQty;
    const totalQty = matchItems.reduce((s, i) => s + i.quantity, 0);
    if (totalQty < minQty) return { discountAmount: 0, description: 'Buy X Pay Y: insufficient items' };

    const qualifyingSets = Math.floor(totalQty / minQty);
    const qualifiedQty = qualifyingSets * minQty;
    const pickCount = qualifyingSets * freeCount;

    if (pickCount <= 0) {
      return { discountAmount: 0, description: describeAllocation(strategy, minQty, payQty, freeCount, qualifyingSets) };
    }

    const allocationItems = matchItems.map((i) => ({
      productId: i.productId,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    }));

    // The free'd units become explicit free-item lines (price 0). The freed value is
    // captured through the free line items (discount = unitPrice * qty), NOT through a
    // proportional cash discount — so the cheapest/most-expensive selection is honored
    // and the cart shows a real "gratis" line that can grow across qualifying sets.
    const alloc = allocateDiscount(strategy, allocationItems, {
      pickCount,
      qualifiedQty,
      minQty,
      freeCount,
    });

    const freeMap = new Map<string, number>();
    for (const s of alloc.selectedItems) {
      freeMap.set(s.productId, (freeMap.get(s.productId) ?? 0) + 1);
    }
    const freeItems = Array.from(freeMap.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    return {
      discountAmount: 0,
      description: describeAllocation(strategy, minQty, payQty, freeCount, qualifyingSets),
      freeItems: freeItems.length > 0 ? freeItems : undefined,
    };
  }
}
