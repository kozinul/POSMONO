import type { ITaxConfiguration, ITaxRule, IModifierConfig } from '../hooks/useTaxConfiguration';

export interface TaxCalcItem {
  productId: string;
  categoryId?: string;
  quantity: number;
  unitPrice: number;
  pricingMode?: 'inclusive' | 'exclusive';
}

export interface TaxCalcInput {
  items: TaxCalcItem[];
  discount?: number;
  discountType?: 'percentage' | 'nominal';
  outletId?: string;
  transactionType?: string;
  customerTags?: string[];
}

export interface TaxBreakdownItem {
  ruleId: string;
  name: string;
  taxType: string;
  rate: number;
  amount: number;
  baseAmount: number;
  priority: number;
}

export interface TaxCalcResult {
  subtotal: number;
  discount: number;
  discountType: string;
  discountAmount: number;
  taxableAmount: number;
  taxBreakdown: TaxBreakdownItem[];
  totalTax: number;
  serviceCharge: number;
  grandTotal: number;
}

function getActiveRules(config: ITaxConfiguration): ITaxRule[] {
  const activeVer = config.versions.find((v) => v.id === config.activeVersionId);
  if (!activeVer) return [];
  return activeVer.rules.filter((r) => {
    if (!r.isActive) return false;
    const now = new Date();
    if (now < new Date(r.effectiveDate)) return false;
    if (r.expiresAt && now > new Date(r.expiresAt)) return false;
    return true;
  });
}

function scopeMatches(rule: ITaxRule, ctx: {
  items: TaxCalcItem[];
  outletId?: string;
  transactionType?: string;
  customerTags?: string[];
}): boolean {
  const s = rule.scope;
  switch (s.type) {
    case 'all': return true;
    case 'category':
      return ctx.items.some((item) => item.categoryId === s.entityId);
    case 'product':
      return ctx.items.some((item) => item.productId === s.entityId);
    case 'outlet':
      return ctx.outletId === s.entityId;
    case 'transaction_type':
      return ctx.transactionType === s.entityId;
    case 'customer':
    case 'service_type':
      return !!(ctx.customerTags && ctx.customerTags.includes(s.entityId));
    default:
      return false;
  }
}

// --- Modifier Engine (client-side mirror) ---

function applyModifier(amount: number, modifier?: IModifierConfig): number {
  if (!modifier || modifier.type === 'none') return amount;

  switch (modifier.type) {
    case 'fraction': {
      if (!modifier.config?.numerator || !modifier.config?.denominator) return amount;
      if (modifier.config.denominator === 0) return amount;
      return amount * (modifier.config.numerator / modifier.config.denominator);
    }
    case 'multiplier': {
      if (modifier.config?.multiplier === undefined) return amount;
      return amount * modifier.config.multiplier;
    }
    case 'fixed_deduction': {
      if (modifier.config?.deduction === undefined) return amount;
      return Math.max(0, amount - modifier.config.deduction);
    }
    default:
      return amount;
  }
}

function roundValue(value: number, mode: string, precision: number): number {
  const factor = Math.pow(10, precision);
  switch (mode) {
    case 'floor': return Math.floor(value * factor) / factor;
    case 'ceil': return Math.ceil(value * factor) / factor;
    case 'round':
    default: return Math.round(value * factor) / factor;
  }
}

function calcDiscount(subtotal: number, discount: number, isPercentage: boolean): number {
  if (discount <= 0) return 0;
  if (isPercentage) return subtotal * (Math.min(discount, 100) / 100);
  return Math.min(discount, subtotal);
}

function calcItemTax(
  itemAmount: number,
  rules: ITaxRule[],
  isInclusive: boolean,
): { tax: number; serviceCharge: number; breakdown: TaxBreakdownItem[] } {
  let totalTax = 0;
  let serviceCharge = 0;
  const breakdown: TaxBreakdownItem[] = [];

  for (const rule of rules) {
    const isExemption = rule.taxType === 'exemption';
    const isSC = rule.taxType === 'service_charge';

    let amount = 0;
    if (isExemption) {
      amount = 0;
    } else if (isInclusive && rule.policy.type !== 'amount') {
      const modifiedBase = applyModifier(itemAmount, rule.modifier);
      amount = roundValue(modifiedBase - (modifiedBase / (1 + rule.policy.value / 100)), rule.policy.roundingMode, rule.policy.precision);
    } else if (rule.policy.type !== 'amount') {
      const modifiedBase = applyModifier(itemAmount, rule.modifier);
      amount = roundValue(modifiedBase * (rule.policy.value / 100), rule.policy.roundingMode, rule.policy.precision);
    } else {
      amount = rule.policy.value;
    }

    breakdown.push({
      ruleId: rule.id,
      name: rule.name,
      taxType: rule.taxType,
      rate: rule.policy.value,
      amount,
      baseAmount: itemAmount,
      priority: rule.priority,
    });

    totalTax += amount;
    if (isSC) serviceCharge += amount;
  }

  return { tax: totalTax, serviceCharge, breakdown };
}

export function calculateTax(input: TaxCalcInput, config: ITaxConfiguration): TaxCalcResult {
  if (!config.taxEnabled) {
    return {
      subtotal: 0, discount: input.discount ?? 0,
      discountType: input.discountType ?? 'nominal',
      discountAmount: 0, taxableAmount: 0,
      taxBreakdown: [], totalTax: 0,
      serviceCharge: 0, grandTotal: 0,
    };
  }

  const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountAmount = calcDiscount(subtotal, input.discount ?? 0, input.discountType === 'percentage');
  const taxableAmount = subtotal - discountAmount;

  const ctx = { items: input.items, outletId: input.outletId, transactionType: input.transactionType, customerTags: input.customerTags };

  const rules = getActiveRules(config)
    .filter((r) => scopeMatches(r, ctx))
    .sort((a, b) => a.priority - b.priority);

  // Check if all items have the same pricing mode (or none)
  const allModes = input.items.map((i) => i.pricingMode).filter(Boolean);
  const uniqueModes = [...new Set(allModes)];

  // If all items share the same pricing mode (or no per-item mode set), use global logic
  if (uniqueModes.length <= 1) {
    const isInclusive = uniqueModes[0] === 'inclusive' || config.pricingMode === 'inclusive';
    const result = calcItemTax(taxableAmount, rules, isInclusive);

    const grandTotal = isInclusive ? taxableAmount : taxableAmount + result.tax;

    return {
      subtotal,
      discount: input.discount ?? 0,
      discountType: input.discountType ?? 'nominal',
      discountAmount,
      taxableAmount,
      taxBreakdown: result.breakdown,
      totalTax: result.tax,
      serviceCharge: result.serviceCharge,
      grandTotal,
    };
  }

  // Mixed pricing modes: calculate per-item
  let totalTax = 0;
  let totalServiceCharge = 0;
  const allBreakdown: TaxBreakdownItem[] = [];

  for (const item of input.items) {
    const itemSubtotal = item.quantity * item.unitPrice;
    // Proportional discount allocation
    const itemDiscount = subtotal > 0 ? (itemSubtotal / subtotal) * discountAmount : 0;
    const itemAmount = itemSubtotal - itemDiscount;
    const itemIsInclusive = item.pricingMode === 'inclusive' || config.pricingMode === 'inclusive';

    const result = calcItemTax(itemAmount, rules, itemIsInclusive);
    totalTax += result.tax;
    totalServiceCharge += result.serviceCharge;
    allBreakdown.push(...result.breakdown);
  }

  // For mixed modes, grandTotal = exclusive items' (price + tax) + inclusive items' (price only)
  let grandTotal = 0;
  for (const item of input.items) {
    const itemSubtotal = item.quantity * item.unitPrice;
    const itemDiscount = subtotal > 0 ? (itemSubtotal / subtotal) * discountAmount : 0;
    const itemAmount = itemSubtotal - itemDiscount;
    const itemIsInclusive = item.pricingMode === 'inclusive' || config.pricingMode === 'inclusive';
    const result = calcItemTax(itemAmount, rules, itemIsInclusive);

    if (itemIsInclusive) {
      grandTotal += itemAmount;
    } else {
      grandTotal += itemAmount + result.tax;
    }
  }

  return {
    subtotal,
    discount: input.discount ?? 0,
    discountType: input.discountType ?? 'nominal',
    discountAmount,
    taxableAmount,
    taxBreakdown: allBreakdown,
    totalTax,
    serviceCharge: totalServiceCharge,
    grandTotal,
  };
}
