import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';
import { countQualifyingSets } from './qualifyingSets';

export class FreeItemEffect implements EffectStrategy {
  readonly type = 'free_item' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const productId = effect.config.productId as string;
    const productName = (effect.config.productName as string) || '';
    const perSet = (effect.config.quantity as number) || 1;
    const item = context.items.find((i) => i.productId === productId);

    const sets = countQualifyingSets(context.conditions, context.items);
    const quantity = perSet * Math.max(sets, 0);

    if (quantity <= 0) {
      return {
        discountAmount: 0,
        description: `${productName || productId} gratis`,
      };
    }

    if (!item) {
      return {
        discountAmount: 0,
        description: `${quantity}x ${productName || productId} gratis`,
        generatedLineItems: [{ productId, productName, categoryId: '', quantity, unitPrice: 0 }],
      };
    }

    return {
      discountAmount: 0,
      description: `${quantity}x ${item.productId} gratis`,
      freeItems: [{ productId, quantity }],
    };
  }
}
