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
  customerTags?: string[];
  currentDate?: Date;
}

export interface DiscountResult {
  totalDiscount: number;
  appliedRules: DiscountRuleResult[];
  freeItems: Array<{ productId: string; quantity: number }>;
  generatedLineItems: Array<{ productId: string; productName: string; categoryId: string; quantity: number; unitPrice: number }>;
  freeItemValue: number;
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
    contextOverrides?: {
      promoCode?: string;
      customerGroupId?: string;
      customerTags?: string[];
      currentDate?: Date;
    },
  ): DiscountResult {
    const sorted = [...rules]
      .filter((r) => r.active)
      .sort((a, b) => a.priority - b.priority);

    const appliedRules: DiscountRuleResult[] = [];
    const freeItems: Array<{ productId: string; quantity: number }> = [];
    const generatedLineItems: Array<{ productId: string; productName: string; categoryId: string; quantity: number; unitPrice: number }> = [];
    let totalDiscount = 0;
    let totalFreeItemValue = 0;
    const itemDiscounts = new Map<string, number>();

    // Free units are taken from the cheapest line of their product: a product
    // can sit in the cart more than once (same product, different modifiers →
    // different unit prices) and a giveaway has to name a unit. The pricing
    // service splits the receipt lines with the same rule, so the quoted
    // amount and the receipt can never disagree about which unit was free.
    const remainingLineQty = items.map((i) => i.quantity);
    const referencePriceByProduct = new Map<string, number>();
    for (const i of items) {
      const current = referencePriceByProduct.get(i.productId);
      if (current === undefined || i.unitPrice < current) {
        referencePriceByProduct.set(i.productId, i.unitPrice);
      }
    }

    for (const ruleData of sorted) {
      const rule = DiscountRule.create(ruleData);

      if (rule.isExpired()) {
        logger.debug({ ruleId: rule.getId(), ruleName: rule.getName() }, 'Discount rule skipped: expired');
        continue;
      }

      const promoCode = contextOverrides?.promoCode;
      const rulePromoCode = rule.getPromoCodeId();
      if (rulePromoCode && rulePromoCode.trim().toUpperCase() !== (promoCode ?? '').trim().toUpperCase()) {
        logger.debug({ ruleId: rule.getId(), ruleName: rule.getName() }, 'Discount rule skipped: promo code mismatch');
        continue;
      }

      const conditionContext: ConditionContext = {
        subtotal,
        items,
        currentDate: contextOverrides?.currentDate,
        customerGroupId: contextOverrides?.customerGroupId,
        customerTags: contextOverrides?.customerTags,
        promoCode,
      };

      if (!this.conditionEvaluator.evaluate(rule.getConditions(), conditionContext, rule.getLogic())) {
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
        conditions: rule.getConditions(),
      };

      const effectResult = this.effectApplier.apply(rule.getEffects(), effectContext);

      // A free-item effect does not produce a cash discount — the value it takes
      // off is carried by the free line. It is reported per rule so the receipt
      // and the order breakdown can show what the promotion actually gave away.
      const ruleFreeItemValue = effectResult.freeItems
        ? this.valueFreeUnits(effectResult.freeItems, items, remainingLineQty, referencePriceByProduct)
        : 0;
      totalFreeItemValue += ruleFreeItemValue;

      logger.info({ ruleId: rule.getId(), ruleName: rule.getName(), discountAmount: effectResult.discountAmount, freeItemValue: ruleFreeItemValue }, 'Discount rule applied');

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
        freeItemValue: ruleFreeItemValue,
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
      freeItemValue: totalFreeItemValue,
      finalSubtotal: subtotal - totalDiscount,
      breakdown: appliedRules,
      itemDiscounts: Array.from(itemDiscounts.entries()).map(([productId, discountAmount]) => ({
        productId,
        discountAmount,
      })),
    };
  }

  /**
   * Value of the free units a promotion hands out: the units actually taken
   * from the cart (cheapest line of the product first) plus the surplus that is
   * handed over as a gift, worth the product's cheapest price — nothing when
   * the product is not in the cart at all.
   */
  private valueFreeUnits(
    freeItems: Array<{ productId: string; quantity: number }>,
    items: DiscountContext['items'],
    remainingLineQty: number[],
    referencePriceByProduct: Map<string, number>,
  ): number {
    let value = 0;

    for (const fi of freeItems) {
      let left = fi.quantity;
      const candidates = items
        .map((item, index) => ({ item, index }))
        .filter(({ item, index }) => item.productId === fi.productId && remainingLineQty[index] > 0)
        .sort((a, b) => a.item.unitPrice - b.item.unitPrice);

      for (const { item, index } of candidates) {
        if (left <= 0) break;
        const take = Math.min(left, remainingLineQty[index]);
        remainingLineQty[index] -= take;
        left -= take;
        value += take * item.unitPrice;
      }

      if (left > 0) {
        value += left * (referencePriceByProduct.get(fi.productId) ?? 0);
      }
    }

    return value;
  }
}
