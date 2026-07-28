import type { IDiscountRule, IDiscountResult } from '../hooks/useDiscountConfiguration';

export interface DiscountCalcItem {
  productId: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
}

export interface ProductDiscountInfo {
  ruleId: string;
  ruleName: string;
  discountPercent: number;
}

function isRuleTimeActive(rule: IDiscountRule): boolean {
  const now = new Date();

  for (const condition of rule.conditions) {
    if (condition.type === 'date_range') {
      const startDate = condition.config.startDate as string | undefined;
      const endDate = condition.config.endDate as string | undefined;
      if (startDate) {
        const start = new Date(startDate);
        if (now < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (now > end) return false;
      }
    }
    if (condition.type === 'day_of_week') {
      const days = condition.config.days as number[];
      if (!days.includes(now.getDay())) return false;
    }
    if (condition.type === 'time_range') {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const fromHour = (condition.config.fromHour as number) ?? 0;
      const fromMinute = (condition.config.fromMinute as number) ?? 0;
      const toHour = (condition.config.toHour as number) ?? 23;
      const toMinute = (condition.config.toMinute as number) ?? 59;
      const fromMinutes = fromHour * 60 + fromMinute;
      const toMinutes = toHour * 60 + toMinute;
      if (currentMinutes < fromMinutes || currentMinutes > toMinutes) return false;
    }
  }

  if (rule.maxUsageCount !== undefined && rule.currentUsageCount >= rule.maxUsageCount) return false;

  return true;
}

export function getActiveProductDiscounts(
  rules: IDiscountRule[],
): Map<string, ProductDiscountInfo> {
  const result = new Map<string, ProductDiscountInfo>();

  const sorted = rules
    .filter((r) => r.active && !r.promoCodeId)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    if (!isRuleTimeActive(rule)) continue;

    const percentEffect = rule.effects.find((e) => e.type === 'percentage_off');
    if (!percentEffect) continue;

    const rate = percentEffect.config.rate as number;
    if (!rate || rate <= 0) continue;

    const info: ProductDiscountInfo = {
      ruleId: rule.id,
      ruleName: rule.name,
      discountPercent: rate,
    };

    if (rule.scope.type === 'all') {
      for (const effect of rule.effects) {
        if (effect.type === 'percentage_off') {
          const r = effect.config.rate as number;
          if (r > (info.discountPercent || 0)) {
            info.discountPercent = r;
          }
        }
      }
      result.set('__all__', info);
    } else if (rule.scope.type === 'product') {
      const entityId = rule.scope.entityId;
      if (entityId && (!result.has(entityId) || rate > (result.get(entityId)?.discountPercent ?? 0))) {
        result.set(entityId, info);
      }
    } else if (rule.scope.type === 'category') {
      const catId = rule.scope.entityId;
      if (catId) {
        const key = `__cat:${catId}__`;
        if (!result.has(key) || rate > (result.get(key)?.discountPercent ?? 0)) {
          result.set(key, info);
        }
      }
    }
  }

  return result;
}

export function getProductDiscount(
  discounts: Map<string, ProductDiscountInfo>,
  productId: string,
  categoryId?: string,
): ProductDiscountInfo | undefined {
  if (discounts.has(productId)) return discounts.get(productId);
  if (categoryId && discounts.has(`__cat:${categoryId}__`)) return discounts.get(`__cat:${categoryId}__`);
  if (discounts.has('__all__')) return discounts.get('__all__');
  return undefined;
}

function evaluateConditions(rule: IDiscountRule, items: DiscountCalcItem[], subtotal: number, promoCode?: string): boolean {
  if (rule.promoCodeId && rule.promoCodeId !== promoCode) return false;

  for (const condition of rule.conditions) {
    switch (condition.type) {
      case 'min_purchase': {
        const min = condition.config.minAmount as number;
        if (subtotal < min) return false;
        break;
      }
      case 'min_items': {
        const min = condition.config.minItems as number;
        const totalQty = items.reduce((s, i) => s + i.quantity, 0);
        if (totalQty < min) return false;
        break;
      }
      case 'category_match': {
        const catIds = condition.config.categoryIds as string[];
        if (!items.some((i) => catIds.includes(i.categoryId))) return false;
        break;
      }
      case 'product_match': {
        const prodIds = condition.config.productIds as string[];
        if (!items.some((i) => prodIds.includes(i.productId))) return false;
        break;
      }
      case 'date_range': {
        const now = new Date();
        const start = new Date(condition.config.startDate as string);
        const end = new Date(condition.config.endDate as string);
        if (now < start || now > end) return false;
        break;
      }
      case 'day_of_week': {
        const days = condition.config.days as number[];
        if (!days.includes(new Date().getDay())) return false;
        break;
      }
      case 'quantity_threshold': {
        const prodId = condition.config.productId as string;
        const minQty = condition.config.minQuantity as number;
        const item = items.find((i) => i.productId === prodId);
        if (!item || item.quantity < minQty) return false;
        break;
      }
      case 'time_range': {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const fromHour = (condition.config.fromHour as number) ?? 0;
        const fromMinute = (condition.config.fromMinute as number) ?? 0;
        const toHour = (condition.config.toHour as number) ?? 23;
        const toMinute = (condition.config.toMinute as number) ?? 59;
        const fromMinutes = fromHour * 60 + fromMinute;
        const toMinutes = toHour * 60 + toMinute;
        if (currentMinutes < fromMinutes || currentMinutes > toMinutes) return false;
        break;
      }
      case 'customer_tag': {
        const requiredTags = (condition.config.tags as string[]) ?? [];
        const customerTags = (condition.config._customerTags as string[]) ?? [];
        if (!requiredTags.some((t) => customerTags.includes(t))) return false;
        break;
      }
    }
  }

  return true;
}

function countQualifyingSets(rule: IDiscountRule, items: DiscountCalcItem[]): number {
  let minQty = 1;
  let matchProductIds: string[] | null = null;

  for (const cond of rule.conditions) {
    if (cond.type === 'min_items') {
      minQty = (cond.config.minItems as number) ?? 1;
    }
    if (cond.type === 'product_match') {
      matchProductIds = (cond.config.productIds as string[]) ?? null;
    }
  }

  if (matchProductIds && matchProductIds.length > 0) {
    const matchCount = items
      .filter((i) => matchProductIds!.includes(i.productId))
      .reduce((s, i) => s + i.quantity, 0);
    return Math.floor(matchCount / minQty);
  }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  return Math.floor(totalQty / minQty);
}

function applyEffects(
  rule: IDiscountRule,
  subtotal: number,
  appliedDiscounts: number,
  freeItemValue: number,
  freeItemCount: number,
): { amount: number; description: string } {
  let total = 0;
  const descParts: string[] = [];

  for (const effect of rule.effects) {
    switch (effect.type) {
      case 'percentage_off': {
        const rate = effect.config.rate as number;
        const maxCap = effect.config.maxCap as number | undefined;
        const target = effect.config.target as string | undefined;
        const base = target === 'remaining' ? subtotal - appliedDiscounts - total : subtotal;
        let amount = base * (rate / 100);
        if (maxCap !== undefined && amount > maxCap) amount = maxCap;
        total += amount;
        descParts.push(`${rate}% off`);
        break;
      }
      case 'nominal_off': {
        const amount = effect.config.amount as number;
        const capped = Math.min(amount, Math.max(0, subtotal - appliedDiscounts - total));
        total += capped;
        descParts.push(`Rp${amount.toLocaleString()} off`);
        break;
      }
      case 'free_item':
        if (freeItemValue > 0) {
          total += freeItemValue;
          descParts.push(`Gratis item (Rp${freeItemValue.toLocaleString()})`);
        } else {
          descParts.push(`Gratis item x${freeItemCount}`);
        }
        break;
      case 'fixed_price':
        descParts.push('Fixed price');
        break;
      case 'bundle_price':
        descParts.push('Bundle price');
        break;
    }
  }

  return { amount: Math.round(total * 100) / 100, description: descParts.join(' + ') || rule.name };
}

export function calculateDiscount(
  items: DiscountCalcItem[],
  rules: IDiscountRule[],
  promoCode?: string,
  productPriceLookup?: (productId: string) => number,
): IDiscountResult {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const sorted = rules
    .filter((r) => r.active)
    .sort((a, b) => a.priority - b.priority);

  let totalDiscount = 0;
  const appliedRules: IDiscountResult['appliedRules'] = [];
  const freeItems: Array<{ productId: string; quantity: number; ruleId: string }> = [];

  for (const rule of sorted) {
    if (!evaluateConditions(rule, items, subtotal, promoCode)) continue;

    const freeEffect = rule.effects.find((e) => e.type === 'free_item');
    let freeItemValue = 0;
    let freeItemCount = 0;

    if (freeEffect) {
      const productId = freeEffect.config.productId as string;
      const qtyPerSet = (freeEffect.config.quantity as number) || 1;
      const sets = countQualifyingSets(rule, items);
      freeItemCount = sets * qtyPerSet;

      if (productPriceLookup && freeItemCount > 0) {
        const freeItemPrice = productPriceLookup(productId);
        freeItemValue = freeItemPrice * freeItemCount;
      }

      freeItems.push({ productId, quantity: freeItemCount, ruleId: rule.id });
    }

    const result = applyEffects(rule, subtotal, totalDiscount, freeItemValue, freeItemCount);
    totalDiscount += result.amount;

    appliedRules.push({
      ruleId: rule.id,
      ruleName: rule.name,
      discountAmount: result.amount,
      description: result.description,
    });

    if (!rule.stackable) break;
  }

  totalDiscount = Math.min(totalDiscount, subtotal);
  totalDiscount = Math.round(totalDiscount * 100) / 100;

  return {
    totalDiscount,
    appliedRules,
    freeItems,
    finalSubtotal: subtotal - totalDiscount,
    breakdown: appliedRules,
  };
}
