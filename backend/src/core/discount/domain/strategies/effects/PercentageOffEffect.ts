import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';
import { getQualifyingItems } from './qualifyingSets';

export class PercentageOffEffect implements EffectStrategy {
  readonly type = 'percentage_off' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const rate = effect.config.rate as number;
    const maxCap = effect.config.maxCap as number | undefined;
    const target = (effect.config.target as string) ?? 'order';

    const scopeSubtotal = context.matchingSubtotal ?? context.subtotal;
    let base: number;
    if (target === 'remaining') {
      base = scopeSubtotal - context.appliedDiscounts;
    } else if (target === 'cheapest_item') {
      // "cheapest_item" discounts one line only — the scope alone would
      // discount the whole order. The line is looked up inside the promotion's
      // own scope, so it cannot land on an item the promotion does not cover.
      const scope = getQualifyingItems(context.conditions, context.items);
      const cheapest = [...scope].sort((a, b) => a.unitPrice - b.unitPrice)[0];
      base = cheapest ? cheapest.lineTotal : 0;
    } else {
      base = scopeSubtotal;
    }
    let amount = base * (rate / 100);
    if (maxCap !== undefined) amount = Math.min(amount, maxCap);

    return {
      discountAmount: Math.round(amount * 100) / 100,
      description: `${rate}% off${maxCap ? ` (max Rp${maxCap.toLocaleString()})` : ''}`,
    };
  }
}
