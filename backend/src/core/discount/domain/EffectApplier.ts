import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './strategies/effects/EffectStrategy';
import { PercentageOffEffect } from './strategies/effects/PercentageOffEffect';
import { NominalOffEffect } from './strategies/effects/NominalOffEffect';
import { FreeItemEffect } from './strategies/effects/FreeItemEffect';
import { FixedPriceEffect } from './strategies/effects/FixedPriceEffect';
import { BundlePriceEffect } from './strategies/effects/BundlePriceEffect';

export class EffectApplier {
  private strategies: Map<string, EffectStrategy> = new Map();

  constructor() {
    this.register(new PercentageOffEffect());
    this.register(new NominalOffEffect());
    this.register(new FreeItemEffect());
    this.register(new FixedPriceEffect());
    this.register(new BundlePriceEffect());
  }

  register(strategy: EffectStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  apply(effects: IDiscountEffect[], context: EffectContext): EffectResult {
    let totalDiscount = 0;
    let description = '';
    const allFreeItems: EffectResult['freeItems'] = [];

    for (const effect of effects) {
      const strategy = this.strategies.get(effect.type);
      if (!strategy) continue;

      const result = strategy.apply(effect, {
        ...context,
        appliedDiscounts: context.appliedDiscounts + totalDiscount,
      });

      totalDiscount += result.discountAmount;
      if (result.description) {
        description += (description ? ' + ' : '') + result.description;
      }
      if (result.freeItems) {
        allFreeItems.push(...result.freeItems);
      }
    }

    return {
      discountAmount: Math.round(totalDiscount * 100) / 100,
      description,
      freeItems: allFreeItems.length > 0 ? allFreeItems : undefined,
    };
  }
}
