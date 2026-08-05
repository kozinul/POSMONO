import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';
import { getQualifyingItems } from './qualifyingSets';

export class BundlePriceEffect implements EffectStrategy {
  readonly type = 'bundle_price' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const productIds = effect.config.productIds as string[] | undefined;
    const bundlePrice = effect.config.bundlePrice as number;

    const matchedItems =
      productIds && productIds.length > 0
        ? context.items.filter((i) => productIds.includes(i.productId))
        : getQualifyingItems(context.conditions, context.items);
    if (matchedItems.length === 0) return { discountAmount: 0, description: 'Bundle (tidak ada item yang cocok)' };

    const originalTotal = matchedItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const saving = originalTotal - bundlePrice;

    return {
      discountAmount: Math.max(0, Math.round(saving * 100) / 100),
      description: `Bundle Rp${new Intl.NumberFormat('id-ID').format(bundlePrice)} (hemat Rp${new Intl.NumberFormat('id-ID').format(Math.round(saving))})`,
    };
  }
}
