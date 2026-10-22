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
    case 'buy_x_get_y': return 'buy_x_get_y';
    default: return 'percentage_off';
  }
}

/**
 * Normalises a date boundary coming from a promotion rule.
 *
 * The promotion form sends plain dates ("2026-10-01") while the discount
 * engine compares timestamps. A date-only value is therefore expanded to the
 * local start/end of that day — otherwise "to" would mean midnight and the
 * whole promotion day would be excluded.
 */
function toIsoBoundary(value: unknown, boundary: 'start' | 'end'): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return undefined;
    const d = new Date(value);
    if (boundary === 'end') d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }

  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}`);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function mapEffects(promoEffects: IPromotionEffect[]): IDiscountEffect[] {
  return promoEffects.map((e) => {
    if (e.type === 'buy_x_pay_y') {
      return {
        type: 'buy_x_pay_y' as IDiscountEffect['type'],
        config: {
          minQty: (e.params?.buyQuantity as number) ?? 1,
          // 0 means "not configured" — the engine treats a promotion that pays
          // for less than one unit as invalid instead of giving the cart away.
          payQty: (e.params?.payQuantity as number) ?? 0,
          allocationStrategy: (e.params?.allocationStrategy as string) ?? 'cheapest',
        },
      };
    }
    if (e.type === 'buy_x_get_y') {
      const targetType = (e.params?.targetType as string) ?? 'cart_item';
      const target: Record<string, unknown> = { type: targetType };
      if (targetType === 'cart_item' || targetType === 'category') {
        target.allocationStrategy = (e.params?.allocationStrategy as string) ?? 'cheapest';
      }
      if (targetType === 'product') {
        target.productId = e.params?.targetProductId as string;
        target.productName = e.params?.targetProductName as string;
      }
      if (targetType === 'category') {
        target.categoryId = e.params?.targetCategoryId as string;
      }
      return {
        type: 'buy_x_get_y' as IDiscountEffect['type'],
        config: {
          buyQuantity: (e.params?.buyQuantity as number) ?? 2,
          getQuantity: (e.params?.getQuantity as number) ?? 1,
          target,
        },
      };
    }
    return {
      type: mapEffectType(e.type),
      config: {
        rate: e.type === 'percentage' ? e.value : undefined,
        amount: e.type === 'nominal' ? e.value : undefined,
        fixedPrice: e.type === 'fixed_price' ? e.value : undefined,
        bundlePrice: e.type === 'bundle_price' ? e.value : undefined,
        // The target and the product may arrive either flat or inside the
        // effect parameters — the promotion form writes both.
        target: e.target ?? (e.params?.target as string),
        productId: e.targetProductId ?? (e.params?.targetProductId as string),
        productName: e.targetProductName ?? (e.params?.targetProductName as string),
        quantity: e.params?.quantity ?? (e.type === 'free_item' ? 1 : undefined),
        maxCap: e.maxDiscount,
      },
    };
  });
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
            startDate:
              toIsoBoundary(rule.params.from, 'start') ??
              toIsoBoundary(rule.params.startDate, 'start') ??
              toIsoBoundary(promo.validFrom, 'start'),
            endDate:
              toIsoBoundary(rule.params.to, 'end') ??
              toIsoBoundary(rule.params.endDate, 'end') ??
              toIsoBoundary(promo.validUntil, 'end'),
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
  }
  // An effect that targets one product must not discount the whole order.
  for (const effect of promo.effects) {
    if (effect.target === 'specific_product' && effect.targetProductId) {
      return { type: 'product', entityId: effect.targetProductId, entityName: effect.targetProductName ?? '' };
    }
  }
  return { type: 'all', entityId: '', entityName: 'Semua' };
}

export function promotionToDiscountRule(promo: IPromotion): IDiscountRule {
  const mainEffect = promo.effects[0];
  const discountType = mainEffect?.type === 'nominal' ? 'nominal' : 'percentage';
  const discountValue = mainEffect?.value ?? 0;
  const promoCode = (promo.code ?? '').trim().toUpperCase();

  const finalEffects = mapEffects(promo.effects);

  return {
    id: `promo_${promo.id}`,
    name: promo.name,
    description: promo.description,
    priority: promo.priority,
    stackable: promo.stackable,
    active: promo.isActive,
    scope: determineScope(promo),
    logic: promo.ruleLogic === 'OR' ? 'OR' : 'AND',
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
