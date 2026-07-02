import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';

export class PercentageOffEffect implements EffectStrategy {
  readonly type = 'percentage_off' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const rate = effect.config.rate as number;
    const maxCap = effect.config.maxCap as number | undefined;
    const target = effect.config.target as 'subtotal' | 'remaining' | undefined;

    const base = target === 'remaining' ? context.subtotal - context.appliedDiscounts : context.subtotal;
    let amount = base * (rate / 100);
    if (maxCap !== undefined) amount = Math.min(amount, maxCap);

    return {
      discountAmount: Math.round(amount * 100) / 100,
      description: `${rate}% off${maxCap ? ` (max Rp${maxCap.toLocaleString()})` : ''}`,
    };
  }
}
