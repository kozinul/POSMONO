import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';

export class BuyXPayYEffect implements EffectStrategy {
  readonly type = 'buy_x_pay_y' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const minQty = (effect.config.minQty as number) ?? 1;
    const payQty = (effect.config.payQty as number) ?? 0;
    const applyTo = (effect.config.applyTo as string) ?? 'cheapest';
    const matchItems = context.matchingItems ?? context.items;

    if (minQty <= payQty) return { discountAmount: 0, description: 'Buy X Pay Y: invalid config' };

    const freeCount = minQty - payQty;
    const totalQty = matchItems.reduce((s, i) => s + i.quantity, 0);
    if (totalQty < minQty) return { discountAmount: 0, description: 'Buy X Pay Y: insufficient items' };

    const qualifyingSets = Math.floor(totalQty / minQty);
    const itemsToDiscount = qualifyingSets * freeCount;

    const sortedByPrice = matchItems
      .flatMap((i) => Array.from({ length: i.quantity }, () => i.unitPrice))
      .sort((a, b) => (applyTo === 'most_expensive' ? b - a : a - b));

    const target = sortedByPrice.slice(0, itemsToDiscount);
    const discountAmount = target.reduce((s, p) => s + p, 0);
    const label = applyTo === 'most_expensive' ? 'termahal' : 'termurah';

    return {
      discountAmount,
      description: `Beli ${minQty} bayar ${payQty} (${freeCount} ${label} gratis x${qualifyingSets})`,
    };
  }
}
