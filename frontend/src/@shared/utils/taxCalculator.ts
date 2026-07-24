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

export function roundIDR(amount: number): number {
  return Math.round(amount / 1000) * 1000;
}

function extractInclusiveDPP(price: number, taxRules: ITaxRule[]): number {
  let totalTax = 0;
  for (const rule of taxRules) {
    if (rule.policy.type === 'amount') continue;
    const rate = rule.policy.value;
    let base = price;
    if (rule.modifier?.type === 'fraction' && rule.modifier.config?.numerator && rule.modifier.config?.denominator) {
      base = price * (rule.modifier.config.numerator / rule.modifier.config.denominator);
    }
    const rawTax = base - base / (1 + rate / 100);
    totalTax += Math.round(roundValue(rawTax, rule.policy.roundingMode, rule.policy.precision));
  }
  return price - totalTax;
}

function calcItemTax(
  itemAmount: number,
  rules: ITaxRule[],
  isInclusive: boolean,
): { tax: number; serviceCharge: number; breakdown: TaxBreakdownItem[] } {
  let totalTax = 0;
  let serviceCharge = 0;
  const breakdown: TaxBreakdownItem[] = [];
  let dppBase = itemAmount;

  for (const rule of rules) {
    const isExemption = rule.taxType === 'exemption';
    const isSC = rule.taxType === 'service_charge';

    const base = isExemption ? 0 : dppBase;

    let amount = 0;
    if (isExemption) {
      amount = 0;
    } else if (isInclusive && !isSC && rule.policy.type !== 'amount') {
      const modifiedBase = applyModifier(dppBase, rule.modifier);
      amount = Math.round(roundValue(modifiedBase - (modifiedBase / (1 + rule.policy.value / 100)), rule.policy.roundingMode, rule.policy.precision));
    } else if (rule.policy.type !== 'amount') {
      const modifiedBase = applyModifier(dppBase, rule.modifier);
      amount = Math.round(roundValue(modifiedBase * (rule.policy.value / 100), rule.policy.roundingMode, rule.policy.precision));
    } else {
      amount = Math.round(rule.policy.value);
    }

    breakdown.push({
      ruleId: rule.id,
      name: rule.name,
      taxType: rule.taxType,
      rate: rule.policy.value,
      amount,
      baseAmount: base,
      priority: rule.priority,
    });

    totalTax += amount;
    if (isSC) {
      serviceCharge += amount;
      dppBase += amount;
    }
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

  // Resolve each item's effective pricing mode (undefined → use global config)
  const resolvedModes = input.items.map((i) => i.pricingMode ?? config.pricingMode);

  // --- Line-based pricing engine ---
  // Per-item: extract DPP, calculate tax, accumulate

  const scRules = rules.filter((r) => r.taxType === 'service_charge');
  const taxRules = rules.filter((r) => r.taxType !== 'service_charge');

  // 1. Calculate global SC rate on total taxableAmount (exclusive items only)
  //    SC applies to exclusive items' DPP
  const exclusiveSubtotal = input.items.reduce((sum, item, idx) => {
    if (resolvedModes[idx] === 'exclusive') {
      return sum + item.quantity * item.unitPrice;
    }
    return sum;
  }, 0);
  // Apply discount proportionally to exclusive items
  const exclusiveDiscount = subtotal > 0 ? (exclusiveSubtotal / subtotal) * discountAmount : 0;
  const exclusiveTaxable = exclusiveSubtotal - exclusiveDiscount;
  const scResult = calcItemTax(exclusiveTaxable, scRules, false);
  const globalSC = scResult.serviceCharge;

  // 2. Per-item line-based calculation
  let totalTax = globalSC;
  let totalSC = 0;
  let totalDpp = 0;
  let grandTotal = 0;
  const allBreakdown: TaxBreakdownItem[] = [...scResult.breakdown];

  for (let idx = 0; idx < input.items.length; idx++) {
    const item = input.items[idx];
    const itemSubtotal = item.quantity * item.unitPrice;
    const itemDiscount = subtotal > 0 ? (itemSubtotal / subtotal) * discountAmount : 0;
    const itemAmount = itemSubtotal - itemDiscount;
    const isInclusive = resolvedModes[idx] === 'inclusive';

    if (isInclusive) {
      const dpp = extractInclusiveDPP(itemAmount, taxRules);
      totalDpp += dpp;
      const itemTax = itemAmount - dpp;
      totalTax += itemTax;
      grandTotal += itemSubtotal;

      for (const rule of taxRules) {
        allBreakdown.push({
          ruleId: rule.id,
          name: rule.name,
          taxType: rule.taxType,
          rate: rule.policy.value,
          amount: Math.round(roundValue(
            (rule.modifier?.type === 'fraction' ? itemAmount * ((rule.modifier.config?.numerator ?? 1) / (rule.modifier.config?.denominator ?? 1)) : itemAmount) - (rule.modifier?.type === 'fraction' ? itemAmount * ((rule.modifier.config?.numerator ?? 1) / (rule.modifier.config?.denominator ?? 1)) : itemAmount) / (1 + rule.policy.value / 100),
            rule.policy.roundingMode, rule.policy.precision,
          )),
          baseAmount: Math.round(dpp),
          priority: rule.priority,
        });
      }
    } else {
      const itemSC = exclusiveTaxable > 0 ? (itemAmount / exclusiveTaxable) * globalSC : 0;
      totalSC += itemSC;
      const dpp = itemAmount + itemSC;
      totalDpp += dpp;

      const taxResult = calcItemTax(dpp, taxRules, false);
      totalTax += taxResult.tax;
      allBreakdown.push(...taxResult.breakdown);
      grandTotal += itemAmount + itemSC + taxResult.tax;
    }
  }

  // Aggregate breakdown by ruleId (merge entries from multiple items with same rule)
  const aggregatedMap = new Map<string, TaxBreakdownItem>();
  for (const entry of allBreakdown) {
    const existing = aggregatedMap.get(entry.ruleId);
    if (existing) {
      existing.amount += entry.amount;
      existing.baseAmount += entry.baseAmount;
    } else {
      aggregatedMap.set(entry.ruleId, { ...entry });
    }
  }
  const aggregatedBreakdown = Array.from(aggregatedMap.values());

  return {
    subtotal,
    discount: input.discount ?? 0,
    discountType: input.discountType ?? 'nominal',
    discountAmount,
    taxableAmount: totalDpp,
    taxBreakdown: aggregatedBreakdown,
    totalTax,
    serviceCharge: globalSC,
    grandTotal,
  };
}
