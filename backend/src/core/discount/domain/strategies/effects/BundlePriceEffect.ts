import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';

export class BundlePriceEffect implements EffectStrategy {
  readonly type = 'bundle_price' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const productIds = effect.config.productIds as string[];
    const bundlePrice = effect.config.bundlePrice as number;

    const matchedItems = context.items.filter((i) => productIds.includes(i.productId));
    if (matchedItems.length === 0) return { discountAmount: 0, description: 'Bundle (items not in cart)' };

    const originalTotal = matchedItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const saving = originalTotal - bundlePrice;

    return {
      discountAmount: Math.max(0, Math.round(saving * 100) / 100),
      description: `Bundle Rp${bundlePrice.toLocaleString()} (hemat Rp${Math.round(saving).toLocaleString()})`,
    };
  }
}
