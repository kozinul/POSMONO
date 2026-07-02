import { DiscountRule, IDiscountRule, DiscountRuleResult } from './DiscountRule';
import { ConditionEvaluator } from './ConditionEvaluator';
import { EffectApplier } from './EffectApplier';
import { ConditionContext } from './strategies/conditions/ConditionStrategy';
import { EffectContext } from './strategies/effects/EffectStrategy';
import { RoundingEngine } from '../../tax/domain/RoundingEngine';

export interface DiscountContext {
  subtotal: number;
  items: Array<{ productId: string; categoryId: string; quantity: number; unitPrice: number; lineTotal: number }>;
  promoCode?: string;
  customerGroupId?: string;
  currentDate?: Date;
}

export interface DiscountResult {
  totalDiscount: number;
  appliedRules: DiscountRuleResult[];
  freeItems: Array<{ productId: string; quantity: number }>;
  finalSubtotal: number;
  breakdown: Array<{ ruleId: string; ruleName: string; discountAmount: number; description: string }>;
}

export class DiscountEngine {
  private readonly conditionEvaluator: ConditionEvaluator;
  private readonly effectApplier: EffectApplier;
  private readonly roundingEngine: RoundingEngine;

  constructor() {
    this.conditionEvaluator = new ConditionEvaluator();
    this.effectApplier = new EffectApplier();
    this.roundingEngine = new RoundingEngine();
  }

  applyDiscounts(
    items: DiscountContext['items'],
    subtotal: number,
    rules: IDiscountRule[],
    contextOverrides?: { promoCode?: string; customerGroupId?: string; currentDate?: Date },
  ): DiscountResult {
    const sorted = [...rules]
      .filter((r) => r.active)
      .sort((a, b) => a.priority - b.priority);

    const appliedRules: DiscountRuleResult[] = [];
    const freeItems: Array<{ productId: string; quantity: number }> = [];
    let totalDiscount = 0;

    for (const ruleData of sorted) {
      const rule = DiscountRule.create(ruleData);

      if (rule.isExpired()) continue;

      const promoCode = contextOverrides?.promoCode;
      if (rule.getPromoCodeId() && rule.getPromoCodeId() !== promoCode) continue;

      const conditionContext: ConditionContext = {
        subtotal,
        items,
        currentDate: contextOverrides?.currentDate,
        customerGroupId: contextOverrides?.customerGroupId,
        promoCode,
      };

      if (!this.conditionEvaluator.evaluate(rule.getConditions(), conditionContext)) continue;

      const effectContext: EffectContext = {
        subtotal,
        items,
        appliedDiscounts: totalDiscount,
      };

      const effectResult = this.effectApplier.apply(rule.getEffects(), effectContext);

      if (effectResult.freeItems) {
        freeItems.push(...effectResult.freeItems);
      }

      const result: DiscountRuleResult = {
        ruleId: rule.getId(),
        ruleName: rule.getName(),
        discountAmount: effectResult.discountAmount,
        description: effectResult.description,
      };

      appliedRules.push(result);
      totalDiscount += effectResult.discountAmount;

      if (!rule.isStackable()) break;
    }

    totalDiscount = Math.min(totalDiscount, subtotal);
    totalDiscount = this.roundingEngine.round(totalDiscount, 'round', 2);

    return {
      totalDiscount,
      appliedRules,
      freeItems,
      finalSubtotal: subtotal - totalDiscount,
      breakdown: appliedRules,
    };
  }
}
