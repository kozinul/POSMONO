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

    const allocationItems = matchItems.map((i) => ({
      productId: i.productId,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    }));

    const result = allocateDiscount(strategy, allocationItems, {
      pickCount,
      qualifiedQty,
      minQty,
      freeCount,
    });

    return {
      discountAmount: result.discountAmount,
      description: describeAllocation(strategy, minQty, payQty, freeCount, qualifyingSets),
    };
  }
}
