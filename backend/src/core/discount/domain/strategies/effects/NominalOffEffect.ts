import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';

export class NominalOffEffect implements EffectStrategy {
  readonly type = 'nominal_off' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const amount = effect.config.amount as number;
    return {
      discountAmount: Math.min(amount, context.subtotal - context.appliedDiscounts),
      description: `Rp${amount.toLocaleString()} off`,
    };
  }
}
