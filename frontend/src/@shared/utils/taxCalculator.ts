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

export interface IChargeConfig {
  id: string;
  name: string;
  rate?: number;
  amount?: number;
  includeInTaxBase: boolean;
  scope?: { type: string; entityId: string; entityName: string };
  priority: number;
  sequence?: number;
  isActive: boolean;
  effectiveDate?: string;
  expiresAt?: string;
}

export interface ChargeItem {
  name: string;
  amount: number;
  includeInTaxBase: boolean;
}

export interface ModifierInfo {
  type: string;
  before: number;
  after: number;
}

export interface TaxLineItem {
  ruleId: string;
  name: string;
  rate: number;
  amount: number;
}

export type AdjustmentType = 'DISCOUNT' | 'CHARGE' | 'TAX' | 'ROUNDING';

export interface Adjustment {
  id: string;
  type: AdjustmentType;
  name: string;
  sequence: number;
  base: number;
  rate?: number;
  amount: number;
  affectsTaxBase: boolean;
  affectsGrandTotal: boolean;
  metadata?: Record<string, unknown>;
}

export interface TaxCalcResult {
  subtotal: number;
  adjustments: Adjustment[];
  discount: number;
  charges: ChargeItem[];
  taxBase: number;
  modifier: ModifierInfo;
  taxes: TaxLineItem[];
  taxAmount: number;
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

function getActiveCharges(config: ITaxConfiguration): IChargeConfig[] {
  const activeVer = config.versions.find((v) => v.id === config.activeVersionId);
  if (!activeVer) return [];
  const charges = (activeVer as any).charges || [];
  return charges.filter((c: IChargeConfig) => {
    if (!c.isActive) return false;
    if (c.expiresAt) {
      const now = new Date();
      if (now > new Date(c.expiresAt)) return false;
    }
    return true;
  });
}

function scopeMatches(
  scope: { type: string; entityId: string; entityName: string } | undefined,
  ctx: { items: TaxCalcItem[]; outletId?: string; transactionType?: string; customerTags?: string[] },
): boolean {
  if (!scope || !scope.type || scope.type === 'all') return true;
  switch (scope.type) {
    case 'category':
      return !!scope.entityId && ctx.items.some((item) => item.categoryId === scope.entityId);
    case 'product':
      return false;
    case 'outlet':
      return ctx.outletId === scope.entityId;
    case 'transaction_type':
      return ctx.transactionType === scope.entityId;
    case 'customer':
    case 'service_type':
      return !!scope.entityId && !!(ctx.customerTags && ctx.customerTags.includes(scope.entityId));
    default:
      return false;
  }
}

function ruleScopeMatches(rule: ITaxRule, ctx: {
  items: TaxCalcItem[];
  outletId?: string;
  transactionType?: string;
  customerTags?: string[];
}): boolean {
  const s = rule.scope;
  switch (s.type) {
    case 'all': return true;
    case 'category':
      return !!s.entityId && ctx.items.some((item) => item.categoryId === s.entityId);
    case 'product':
      return !!s.entityId && ctx.items.some((item) => item.productId === s.entityId);
    case 'outlet':
      return ctx.outletId === s.entityId;
    case 'transaction_type':
      return ctx.transactionType === s.entityId;
    case 'customer':
    case 'service_type':
      return !!s.entityId && !!(ctx.customerTags && ctx.customerTags.includes(s.entityId));
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

function calcInclusiveRuleAmount(price: number, rule: ITaxRule): number {
  if (rule.policy.type === 'amount') return Math.round(rule.policy.value);
  const modifiedBase = applyModifier(price, rule.modifier);
  const rawTax = modifiedBase - modifiedBase / (1 + rule.policy.value / 100);
  return roundValue(rawTax, rule.policy.roundingMode, rule.policy.precision);
}

function calculateCharge(charge: IChargeConfig, base: number): number {
  if (charge.rate !== undefined) {
    return Math.round(base * (charge.rate / 100));
  }
  if (charge.amount !== undefined) {
    return Math.round(charge.amount);
  }
  return 0;
}

function calculateChargeInclusive(charge: IChargeConfig, price: number): number {
  if (charge.rate !== undefined) {
    const divisor = 1 + charge.rate / 100;
    return Math.round(price - price / divisor);
  }
  if (charge.amount !== undefined) {
    return Math.min(Math.round(charge.amount), price);
  }
  return 0;
}

function accumulateTax(
  map: Map<string, TaxLineItem>,
  rule: ITaxRule,
  amount: number,
): void {
  const existing = map.get(rule.id);
  if (existing) {
    existing.amount += amount;
  } else {
    map.set(rule.id, { ruleId: rule.id, name: rule.name, rate: rule.policy.value, amount });
  }
}

function accumulateCharge(
  map: Map<string, ChargeItem>,
  charge: IChargeConfig,
  amount: number,
): void {
  const existing = map.get(charge.id);
  if (existing) {
    existing.amount += amount;
  } else {
    map.set(charge.id, { name: charge.name, amount, includeInTaxBase: charge.includeInTaxBase });
  }
}

function calculateGlobalCharges(charges: IChargeConfig[], exclusiveTaxable: number): number[] {
  const amounts: number[] = [];
  let base = exclusiveTaxable;
  for (const charge of charges) {
    const amount = calculateCharge(charge, base);
    amounts.push(amount);
    if (charge.includeInTaxBase) {
      base += amount;
    }
  }
  return amounts;
}

export function calculateTax(input: TaxCalcInput, config: ITaxConfiguration): TaxCalcResult {
  if (!config.taxEnabled) {
    const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const discountAmount = calcDiscount(subtotal, input.discount ?? 0, input.discountType === 'percentage');
    return {
      subtotal,
      adjustments: [],
      discount: discountAmount,
      charges: [],
      taxBase: subtotal - discountAmount,
      modifier: { type: 'none', before: 0, after: 0 },
      taxes: [],
      taxAmount: 0,
      grandTotal: subtotal - discountAmount,
    };
  }

  const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountAmount = calcDiscount(subtotal, input.discount ?? 0, input.discountType === 'percentage');

  const ctx = { items: input.items, outletId: input.outletId, transactionType: input.transactionType, customerTags: input.customerTags };

  const rules = getActiveRules(config)
    .filter((r) => ruleScopeMatches(r, ctx))
    .sort((a, b) => a.priority - b.priority);

  const charges = getActiveCharges(config)
    .filter((c) => scopeMatches(c.scope, ctx))
    .sort((a, b) => a.priority - b.priority);

  const resolvedModes = input.items.map((i) => i.pricingMode ?? config.pricingMode);

  const exclusiveSubtotal = input.items.reduce((sum, item, idx) => {
    if (resolvedModes[idx] === 'exclusive') {
      return sum + item.quantity * item.unitPrice;
    }
    return sum;
  }, 0);
  const exclusiveDiscount = subtotal > 0 ? (exclusiveSubtotal / subtotal) * discountAmount : 0;
  const exclusiveTaxable = exclusiveSubtotal - exclusiveDiscount;

  const globalChargeAmounts = calculateGlobalCharges(charges, exclusiveTaxable);

  let totalTax = 0;
  let totalDpp = 0;
  let totalModifierBase = 0;
  let grandTotal = 0;
  const taxAccumulator = new Map<string, TaxLineItem>();
  const chargeAccumulator = new Map<string, ChargeItem>();
  const allAdjustments: Adjustment[] = [];

  for (let idx = 0; idx < input.items.length; idx++) {
    const item = input.items[idx];
    const itemSubtotal = item.quantity * item.unitPrice;
    const itemDiscount = subtotal > 0 ? (itemSubtotal / subtotal) * discountAmount : 0;
    const itemAmount = itemSubtotal - itemDiscount;
    const isInclusive = resolvedModes[idx] === 'inclusive';

    if (isInclusive) {
      let remaining = itemAmount;

      for (const charge of charges) {
        const amount = calculateChargeInclusive(charge, remaining);
        accumulateCharge(chargeAccumulator, charge, amount);
        allAdjustments.push({
          id: charge.id,
          type: 'CHARGE',
          name: charge.name,
          sequence: (charge as any).sequence ?? 20,
          base: remaining,
          rate: charge.rate,
          amount,
          affectsTaxBase: charge.includeInTaxBase,
          affectsGrandTotal: true,
        });
        remaining -= amount;
      }

      let itemTax = 0;
      for (const rule of rules) {
        const amount = calcInclusiveRuleAmount(remaining, rule);
        accumulateTax(taxAccumulator, rule, amount);
        itemTax += amount;

        const metadata: Record<string, unknown> = {};
        if (rule.modifier && rule.modifier.type !== 'none') {
          metadata.modifier = rule.modifier.type === 'fraction'
            ? `${rule.modifier.config?.numerator}/${rule.modifier.config?.denominator}`
            : rule.modifier.type;
        }

        allAdjustments.push({
          id: rule.id,
          type: 'TAX',
          name: rule.name,
          sequence: (rule as any).sequence ?? 30,
          base: remaining,
          rate: rule.policy.value,
          amount,
          affectsTaxBase: false,
          affectsGrandTotal: true,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        });
        remaining -= amount;
      }

      totalDpp += remaining;
      totalTax += itemTax;
      grandTotal += itemAmount;
    } else {
      const itemShare = exclusiveTaxable > 0 ? itemAmount / exclusiveTaxable : 0;

      let itemChargeTotal = 0;
      let itemChargeInDpp = 0;
      for (let i = 0; i < charges.length; i++) {
        const proportionalAmount = itemShare * globalChargeAmounts[i];
        itemChargeTotal += proportionalAmount;
        if (charges[i].includeInTaxBase) {
          itemChargeInDpp += proportionalAmount;
        }
      }

      const dpp = itemAmount + itemChargeInDpp;
      totalDpp += dpp;

      let itemTax = 0;
      for (const rule of rules) {
        let amount = 0;
        if (rule.taxType === 'exemption') {
          amount = 0;
        } else if (rule.policy.type !== 'amount') {
          const modifiedBase = applyModifier(dpp, rule.modifier);
          totalModifierBase += modifiedBase;
          amount = roundValue(modifiedBase * (rule.policy.value / 100), rule.policy.roundingMode, rule.policy.precision);
        } else {
          amount = Math.round(rule.policy.value);
        }
        accumulateTax(taxAccumulator, rule, amount);
        itemTax += amount;

        const metadata: Record<string, unknown> = {};
        if (rule.modifier && rule.modifier.type !== 'none') {
          metadata.modifier = rule.modifier.type === 'fraction'
            ? `${rule.modifier.config?.numerator}/${rule.modifier.config?.denominator}`
            : rule.modifier.type;
        }

        allAdjustments.push({
          id: rule.id,
          type: 'TAX',
          name: rule.name,
          sequence: (rule as any).sequence ?? 30,
          base: dpp,
          rate: rule.policy.value,
          amount,
          affectsTaxBase: false,
          affectsGrandTotal: true,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        });
      }
      totalTax += itemTax;
      grandTotal += itemAmount + itemChargeTotal + itemTax;

      for (let i = 0; i < charges.length; i++) {
        const proportionalAmount = itemShare * globalChargeAmounts[i];
        accumulateCharge(chargeAccumulator, charges[i], proportionalAmount);

        allAdjustments.push({
          id: charges[i].id,
          type: 'CHARGE',
          name: charges[i].name,
          sequence: (charges[i] as any).sequence ?? 20,
          base: itemAmount,
          rate: charges[i].rate,
          amount: proportionalAmount,
          affectsTaxBase: charges[i].includeInTaxBase,
          affectsGrandTotal: true,
        });
      }
    }
  }

  const chargeItems: ChargeItem[] = Array.from(chargeAccumulator.values());
  const taxes: TaxLineItem[] = Array.from(taxAccumulator.values());
  const modifierType = rules.length > 0 ? (rules[0].modifier?.type ?? 'none') : 'none';

  if (discountAmount > 0) {
    allAdjustments.unshift({
      id: 'discount_global',
      type: 'DISCOUNT',
      name: 'Diskon',
      sequence: 10,
      base: subtotal,
      rate: input.discountType === 'percentage' ? input.discount : undefined,
      amount: -discountAmount,
      affectsTaxBase: true,
      affectsGrandTotal: true,
    });
  }

  allAdjustments.sort((a, b) => a.sequence - b.sequence);

  return {
    subtotal,
    adjustments: allAdjustments,
    discount: discountAmount,
    charges: chargeItems,
    taxBase: Math.round(totalDpp),
    modifier: {
      type: modifierType,
      before: Math.round(totalDpp),
      after: Math.round(totalModifierBase),
    },
    taxes,
    taxAmount: Math.round(totalTax),
    grandTotal: Math.round(grandTotal),
  };
}
