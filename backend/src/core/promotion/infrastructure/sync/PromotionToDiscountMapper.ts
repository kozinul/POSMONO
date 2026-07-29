import { IPromotion, IPromotionEffect } from '../../domain/Promotion';
import { IDiscountRule } from '../../../discount/domain/DiscountRule';
import { IDiscountCondition } from '../../../discount/domain/strategies/conditions/ConditionStrategy';
import { IDiscountEffect } from '../../../discount/domain/strategies/effects/EffectStrategy';
import { DiscountScopeType } from '../../../discount/domain/DiscountScope';

function mapEffectType(type: string): IDiscountEffect['type'] {
  switch (type) {
    case 'percentage': return 'percentage_off';
    case 'nominal': return 'nominal_off';
    case 'free_item': return 'free_item';
    case 'fixed_price': return 'fixed_price';
    case 'bundle_price': return 'bundle_price';
    case 'buy_x_pay_y': return 'buy_x_pay_y';
    default: return 'percentage_off';
  }
}

function mapEffects(promoEffects: IPromotionEffect[]): IDiscountEffect[] {
  return promoEffects.map((e) => ({
    type: mapEffectType(e.type),
    config: {
      rate: e.type === 'percentage' ? e.value : undefined,
      amount: e.type === 'nominal' ? e.value : undefined,
      target: e.target,
      productId: e.targetProductId,
      maxCap: e.maxDiscount,
    },
  }));
}

function mapRules(promo: IPromotion): IDiscountCondition[] {
  const conditions: IDiscountCondition[] = [];

  if (promo.minPurchase > 0) {
    conditions.push({
      type: 'min_purchase',
      config: { minAmount: promo.minPurchase },
    });
  }

  for (const rule of promo.rules) {
    const ruleType = rule.type as string;
    switch (ruleType) {
      case 'min_purchase':
        conditions.push({
          type: 'min_purchase',
          config: { minAmount: rule.params.amount ?? rule.params.minAmount ?? 0 },
        });
        break;
      case 'min_items':
        conditions.push({
          type: 'min_items',
          config: { minItems: rule.params.count ?? rule.params.minItems ?? 0 },
        });
        break;
      case 'buy_x_get_y':
      case 'buy_x_pay_y': {
        const buyIds = (rule.params.buyProductIds as string[]) ?? [];
        if (buyIds.length > 0) {
          conditions.push({
            type: 'product_match',
            config: { productIds: buyIds },
          });
        }
        const buyQty = (rule.params.buyQuantity as number) ?? 1;
        if (buyQty > 1) {
          conditions.push({
            type: 'min_items',
            config: { minItems: buyQty },
          });
        }
        break;
      }
      case 'category_match':
        conditions.push({
          type: 'category_match',
          config: { categoryIds: rule.params.categoryIds ?? [] },
        });
        break;
      case 'product_match':
        conditions.push({
          type: 'product_match',
          config: { productIds: rule.params.productIds ?? [] },
        });
        break;
      case 'day_of_week':
        conditions.push({
          type: 'day_of_week',
          config: { days: rule.params.days ?? [] },
        });
        break;
      case 'date_range':
        conditions.push({
          type: 'date_range',
          config: {
            startDate: rule.params.startDate ?? promo.validFrom,
            endDate: rule.params.endDate ?? promo.validUntil,
          },
        });
        break;
      case 'time_range':
        conditions.push({
          type: 'time_range',
          config: {
            fromHour: rule.params.fromHour ?? 0,
            fromMinute: rule.params.fromMinute ?? 0,
            toHour: rule.params.toHour ?? 23,
            toMinute: rule.params.toMinute ?? 59,
          },
        });
        break;
      case 'customer_tag':
        conditions.push({
          type: 'customer_tag',
          config: { tags: rule.params.tags ?? [] },
        });
        break;
      case 'quantity_threshold':
        conditions.push({
          type: 'quantity_threshold',
          config: {
            productId: rule.params.productId ?? '',
            minQuantity: rule.params.minQuantity ?? 1,
          },
        });
        break;
    }
  }

  if (promo.validFrom || promo.validUntil) {
    const hasDateRange = conditions.some((c) => c.type === 'date_range');
    if (!hasDateRange) {
      let endDateStr: string | undefined;
      if (promo.validUntil) {
        const d = new Date(promo.validUntil);
        d.setHours(23, 59, 59, 999);
        endDateStr = d.toISOString();
      }
      conditions.push({
        type: 'date_range',
        config: {
          startDate: promo.validFrom ? new Date(promo.validFrom).toISOString() : undefined,
          endDate: endDateStr,
        },
      });
    }
  }

  return conditions;
}

function determineScope(promo: IPromotion): { type: DiscountScopeType; entityId: string; entityName: string } {
  for (const rule of promo.rules) {
    const ruleType = rule.type as string;
    if (ruleType === 'category_match') {
      const ids = (rule.params.categoryIds as string[]) || [];
      if (ids.length === 1) {
        return { type: 'category', entityId: ids[0], entityName: '' };
      }
    }
    if (ruleType === 'product_match') {
      const ids = (rule.params.productIds as string[]) || [];
      if (ids.length === 1) {
        return { type: 'product', entityId: ids[0], entityName: '' };
      }
    }
    if (ruleType === 'buy_x_get_y' || ruleType === 'buy_x_pay_y') {
      const ids = (rule.params.buyProductIds as string[]) || [];
      if (ids.length === 1) {
        return { type: 'product', entityId: ids[0], entityName: '' };
      }
    }
  }
  return { type: 'all', entityId: '', entityName: 'Semua' };
}

export function promotionToDiscountRule(promo: IPromotion): IDiscountRule {
  const mainEffect = promo.effects[0];
  const discountType = mainEffect?.type === 'nominal' ? 'nominal' : 'percentage';
  const discountValue = mainEffect?.value ?? 0;
  const promoCode = promo.code.trim().toUpperCase();

  const buyXPayYRule = promo.rules.find((r) => r.type === 'buy_x_pay_y');
  const finalEffects = buyXPayYRule
    ? [
        {
          type: 'buy_x_pay_y' as IDiscountEffect['type'],
          config: {
            minQty: (buyXPayYRule.params.buyQuantity as number) ?? 1,
            payQty: (buyXPayYRule.params.payQuantity as number) ?? 0,
            applyTo: (buyXPayYRule.params.applyTo as string) ?? 'cheapest',
          },
        },
      ]
    : mapEffects(promo.effects);

  return {
    id: `promo_${promo.id}`,
    name: promo.name,
    description: promo.description,
    priority: promo.priority,
    stackable: promo.stackable,
    active: promo.isActive,
    scope: determineScope(promo),
    policy: {
      type: discountType,
      value: discountValue,
      application: 'per_order',
      roundingMode: 'round',
      precision: 2,
    },
    conditions: mapRules(promo),
    effects: finalEffects,
    promoCodeId: promoCode || undefined,
    currentUsageCount: promo.usedCount,
    maxUsageCount: promo.usageLimit ?? undefined,
    startDate: promo.validFrom ? new Date(promo.validFrom).toISOString() : undefined,
    endDate: promo.validUntil
      ? (() => {
          const d = new Date(promo.validUntil);
          const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
          if (!hasTime) {
            d.setHours(23, 59, 59, 999);
          }
          return d.toISOString();
        })()
      : undefined,
  };
}
