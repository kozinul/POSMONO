import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';
import { getQualifyingItems } from './qualifyingSets';

export class FixedPriceEffect implements EffectStrategy {
  readonly type = 'fixed_price' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const fixedPrice = (effect.config.fixedPrice as number) ?? (effect.config.amount as number) ?? 0;
    const productId = effect.config.productId as string | undefined;

    const targetItems = productId
      ? context.items.filter((i) => i.productId === productId)
      : getQualifyingItems(context.conditions, context.items);

    if (targetItems.length === 0) {
      return { discountAmount: 0, description: 'Fixed price (tidak ada item yang cocok)' };
    }

    const saving = targetItems.reduce(
      (s, i) => s + Math.max(0, i.unitPrice - fixedPrice) * i.quantity,
      0,
    );

    return {
      discountAmount: Math.round(saving * 100) / 100,
      description: `Harga spesial Rp${new Intl.NumberFormat('id-ID').format(fixedPrice)}`,
    };
  }
}
