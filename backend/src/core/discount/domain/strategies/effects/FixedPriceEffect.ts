import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';

export class FixedPriceEffect implements EffectStrategy {
  readonly type = 'fixed_price' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const productId = effect.config.productId as string;
    const fixedPrice = effect.config.fixedPrice as number;
    const item = context.items.find((i) => i.productId === productId);

    if (!item) return { discountAmount: 0, description: 'Fixed price (not in cart)' };

    const saving = (item.unitPrice - fixedPrice) * item.quantity;
    return {
      discountAmount: Math.max(0, Math.round(saving * 100) / 100),
      description: `Harga spesial Rp${fixedPrice.toLocaleString()}/${item.productId}`,
    };
  }
}
