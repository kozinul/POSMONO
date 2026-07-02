import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';

export class FreeItemEffect implements EffectStrategy {
  readonly type = 'free_item' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const productId = effect.config.productId as string;
    const quantity = (effect.config.quantity as number) || 1;
    const item = context.items.find((i) => i.productId === productId);

    if (!item) return { discountAmount: 0, description: 'Free item (not in cart)' };

    const freeQty = Math.min(quantity, item.quantity);
    return {
      discountAmount: 0,
      description: `${freeQty}x ${item.productId} gratis`,
      freeItems: [{ productId, quantity: freeQty }],
    };
  }
}
