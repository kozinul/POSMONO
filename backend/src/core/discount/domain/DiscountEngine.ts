import { DiscountRule, IDiscountRule, DiscountRuleResult } from './DiscountRule';
import { ConditionEvaluator } from './ConditionEvaluator';
import { EffectApplier } from './EffectApplier';
import { ConditionContext } from './strategies/conditions/ConditionStrategy';
import { EffectContext } from './strategies/effects/EffectStrategy';
import { RoundingEngine } from '../../tax/domain/RoundingEngine';
import { DiscountScope } from './DiscountScope';
import { logger } from '../../../@shared/infrastructure/logger/Logger';

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
  generatedLineItems: Array<{ productId: string; productName: string; categoryId: string; quantity: number; unitPrice: number }>;
  finalSubtotal: number;
  breakdown: Array<{ ruleId: string; ruleName: string; discountAmount: number; description: string }>;
  itemDiscounts: Array<{ productId: string; discountAmount: number }>;
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

  private resolveScopeItems(
    items: DiscountContext['items'],
    scope: DiscountScope,
  ): { matchingItems: DiscountContext['items']; matchingSubtotal: number } {
    const scopeType = scope.getType();
    const scopeEntityId = scope.getEntityId();

    switch (scopeType) {
      case 'all':
        return {
          matchingItems: items,
          matchingSubtotal: items.reduce((s, i) => s + i.lineTotal, 0),
        };
      case 'category': {
        const matching = items.filter((i) => i.categoryId === scopeEntityId);
        return {
          matchingItems: matching,
          matchingSubtotal: matching.reduce((s, i) => s + i.lineTotal, 0),
        };
      }
      case 'product': {
        const matching = items.filter((i) => i.productId === scopeEntityId);
        return {
          matchingItems: matching,
          matchingSubtotal: matching.reduce((s, i) => s + i.lineTotal, 0),
        };
      }
      default:
        return {
          matchingItems: items,
          matchingSubtotal: items.reduce((s, i) => s + i.lineTotal, 0),
        };
    }
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
    const generatedLineItems: Array<{ productId: string; productName: string; categoryId: string; quantity: number; unitPrice: number }> = [];
    let totalDiscount = 0;
    const itemDiscounts = new Map<string, number>();

    for (const ruleData of sorted) {
      const rule = DiscountRule.create(ruleData);

      if (rule.isExpired()) {
        logger.debug({ ruleId: rule.getId(), ruleName: rule.getName() }, 'Discount rule skipped: expired');
        continue;
      }

      const promoCode = contextOverrides?.promoCode;
      if (rule.getPromoCodeId() && rule.getPromoCodeId() !== promoCode) {
        logger.debug({ ruleId: rule.getId(), ruleName: rule.getName() }, 'Discount rule skipped: promo code mismatch');
        continue;
      }

      const conditionContext: ConditionContext = {
        subtotal,
        items,
        currentDate: contextOverrides?.currentDate,
        customerGroupId: contextOverrides?.customerGroupId,
        promoCode,
      };

      if (!this.conditionEvaluator.evaluate(rule.getConditions(), conditionContext)) {
        logger.debug({ ruleId: rule.getId(), ruleName: rule.getName() }, 'Discount rule skipped: conditions not met');
        continue;
      }

      const { matchingItems, matchingSubtotal } = this.resolveScopeItems(items, rule.getScope());
      if (matchingItems.length === 0) {
        logger.debug({ ruleId: rule.getId(), ruleName: rule.getName() }, 'Discount rule skipped: no matching items');
        continue;
      }

      const effectContext: EffectContext = {
        subtotal,
        items,
        appliedDiscounts: totalDiscount,
        matchingSubtotal,
        matchingItems,
      };

      const effectResult = this.effectApplier.apply(rule.getEffects(), effectContext);

      logger.info({ ruleId: rule.getId(), ruleName: rule.getName(), discountAmount: effectResult.discountAmount }, 'Discount rule applied');

      if (effectResult.freeItems) {
        freeItems.push(...effectResult.freeItems);
      }
      if (effectResult.generatedLineItems) {
        generatedLineItems.push(...effectResult.generatedLineItems);
      }

      // Distribute discount across matching items proportionally
      if (effectResult.discountAmount > 0 && matchingSubtotal > 0) {
        for (const mi of matchingItems) {
          const share = mi.lineTotal / matchingSubtotal;
          const itemDisc = Math.round(effectResult.discountAmount * share * 100) / 100;
          itemDiscounts.set(mi.productId, (itemDiscounts.get(mi.productId) || 0) + itemDisc);
        }
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
      generatedLineItems,
      finalSubtotal: subtotal - totalDiscount,
      breakdown: appliedRules,
      itemDiscounts: Array.from(itemDiscounts.entries()).map(([productId, discountAmount]) => ({
        productId,
        discountAmount,
      })),
    };
  }
}
