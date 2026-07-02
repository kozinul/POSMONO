import type { IDiscountRule, IDiscountResult } from '../hooks/useDiscountConfiguration';

export interface DiscountCalcItem {
  productId: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
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
    }
  }

  return true;
}

function applyEffects(rule: IDiscountRule, subtotal: number, appliedDiscounts: number): { amount: number; description: string } {
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
        descParts.push('Free item');
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
): IDiscountResult {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const sorted = rules
    .filter((r) => r.active)
    .sort((a, b) => a.priority - b.priority);

  let totalDiscount = 0;
  const appliedRules: IDiscountResult['appliedRules'] = [];
  const freeItems: Array<{ productId: string; quantity: number }> = [];

  for (const rule of sorted) {
    if (!evaluateConditions(rule, items, subtotal, promoCode)) continue;

    const result = applyEffects(rule, subtotal, totalDiscount);
    totalDiscount += result.amount;

    appliedRules.push({
      ruleId: rule.id,
      ruleName: rule.name,
      discountAmount: result.amount,
      description: result.description,
    });

    const freeEffect = rule.effects.find((e) => e.type === 'free_item');
    if (freeEffect) {
      const productId = freeEffect.config.productId as string;
      const qty = (freeEffect.config.quantity as number) || 1;
      freeItems.push({ productId, quantity: qty });
    }

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
