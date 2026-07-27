import { TaxConfiguration } from './TaxConfiguration';
import { TaxRule } from './TaxRule';
import { Charge } from './Charge';
import { ScopeMatchContext } from './TaxScope';
import { ModifierEngine } from './ModifierEngine';
import { Adjustment, AdjustmentStep, PipelineContext } from './Adjustment';
import { AdjustmentPipeline } from './AdjustmentPipeline';
import { ChargeStep } from './steps/ChargeStep';
import { TaxStep } from './steps/TaxStep';

export interface TaxItem {
  id: string;
  productId: string;
  productName: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  pricingMode?: 'inclusive' | 'exclusive';
}

export interface PricingInput {
  tenantId: string;
  items: TaxItem[];
  discount?: number;
  discountType?: 'percentage' | 'nominal';
  customerTags?: string[];
  outletId?: string;
  transactionType?: string;
  orderId?: string;
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
  name: string;
  rate: number;
  amount: number;
}

export interface PricingResult {
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

export class PricingEngine {
  private static readonly modifierEngine = new ModifierEngine();
  private static readonly pipeline = new AdjustmentPipeline();

  calculate(input: PricingInput, config: TaxConfiguration, allowedRuleIds?: string[]): PricingResult {
    if (!config.isTaxEnabled()) {
      return this.emptyResult(input);
    }

    const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const discountAmount = this.calcDiscount(subtotal, input.discount ?? 0, input.discountType);
    const globalMode = config.getPricingMode();

    const scopeCtx: ScopeMatchContext = {
      items: input.items,
      outletId: input.outletId,
      transactionType: input.transactionType,
      customerTags: input.customerTags,
    };

    let rules = config.getActiveRules().filter((r) => r.shouldApply(scopeCtx));
    if (allowedRuleIds) {
      const idSet = new Set(allowedRuleIds);
      rules = rules.filter((r) => idSet.has(r.getId()));
    }
    rules.sort((a, b) => a.getPriority() - b.getPriority());

    let charges = config.getActiveCharges().filter((c) => c.shouldApply(scopeCtx));
    charges.sort((a, b) => a.getPriority() - b.getPriority());

    const exclusiveSubtotal = input.items.reduce((sum, item) => {
      const mode = item.pricingMode ?? globalMode;
      if (mode === 'exclusive') return sum + item.quantity * item.unitPrice;
      return sum;
    }, 0);
    const exclusiveDiscount = subtotal > 0 ? (exclusiveSubtotal / subtotal) * discountAmount : 0;
    const exclusiveTaxable = exclusiveSubtotal - exclusiveDiscount;

    const globalChargeAmounts = this.calculateGlobalCharges(charges, exclusiveTaxable);

    let totalTax = 0;
    let totalDpp = 0;
    let totalModifierBase = 0;
    let grandTotal = 0;
    const taxAccumulator = new Map<string, { name: string; rate: number; amount: number }>();
    const chargeAccumulator = new Map<string, { name: string; amount: number; includeInTaxBase: boolean }>();
    const allAdjustments: Adjustment[] = [];

    for (const item of input.items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = subtotal > 0 ? (itemSubtotal / subtotal) * discountAmount : 0;
      const itemAmount = itemSubtotal - itemDiscount;
      const isInclusive = (item.pricingMode ?? globalMode) === 'inclusive';

      if (isInclusive) {
        let remaining = itemAmount;

        for (const charge of charges) {
          const amount = charge.calculateInclusive(remaining);
          this.accumulateCharge(chargeAccumulator, charge, amount);
          allAdjustments.push({
            id: charge.getId(),
            type: 'CHARGE',
            name: charge.getName(),
            sequence: charge.getSequence(),
            base: remaining,
            rate: charge.getRate(),
            amount,
            affectsTaxBase: charge.isIncludedInTaxBase(),
            affectsGrandTotal: true,
          });
          remaining -= amount;
        }

        let itemTax = 0;
        for (const rule of rules) {
          const amount = rule.calculateTax(remaining, true);
          const modBase = PricingEngine.modifierEngine.apply(remaining, rule.getModifier());
          totalModifierBase += modBase;
          this.accumulateTax(taxAccumulator, rule, amount);
          itemTax += amount;

          const metadata: Record<string, unknown> = {};
          const modifierCfg = rule.getModifier();
          if (modifierCfg && modifierCfg.type !== 'none') {
            metadata.modifier = modifierCfg.type === 'fraction'
              ? `${modifierCfg.config?.numerator}/${modifierCfg.config?.denominator}`
              : modifierCfg.type;
          }

          allAdjustments.push({
            id: rule.getId(),
            type: 'TAX',
            name: rule.getName(),
            sequence: rule.getSequence(),
            base: remaining,
            rate: rule.getPolicy().getValue(),
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
          if (charges[i].isIncludedInTaxBase()) {
            itemChargeInDpp += proportionalAmount;
          }
        }

        const dpp = itemAmount + itemChargeInDpp;
        totalDpp += dpp;

        let itemTax = 0;
        for (const rule of rules) {
          const taxAmount = rule.calculateTax(dpp, false);
          const modBase = PricingEngine.modifierEngine.apply(dpp, rule.getModifier());
          totalModifierBase += modBase;
          this.accumulateTax(taxAccumulator, rule, taxAmount);
          itemTax += taxAmount;

          const metadata: Record<string, unknown> = {};
          const modifierCfg = rule.getModifier();
          if (modifierCfg && modifierCfg.type !== 'none') {
            metadata.modifier = modifierCfg.type === 'fraction'
              ? `${modifierCfg.config?.numerator}/${modifierCfg.config?.denominator}`
              : modifierCfg.type;
            metadata.modifierBefore = dpp;
            metadata.modifierAfter = modBase;
          }

          allAdjustments.push({
            id: rule.getId(),
            type: 'TAX',
            name: rule.getName(),
            sequence: rule.getSequence(),
            base: dpp,
            rate: rule.getPolicy().getValue(),
            amount: taxAmount,
            affectsTaxBase: false,
            affectsGrandTotal: true,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          });
        }
        totalTax += itemTax;
        grandTotal += itemAmount + itemChargeTotal + itemTax;

        for (let i = 0; i < charges.length; i++) {
          const proportionalAmount = itemShare * globalChargeAmounts[i];
          this.accumulateChargeRaw(chargeAccumulator, charges[i], proportionalAmount);

          allAdjustments.push({
            id: charges[i].getId(),
            type: 'CHARGE',
            name: charges[i].getName(),
            sequence: charges[i].getSequence(),
            base: itemAmount,
            rate: charges[i].getRate(),
            amount: proportionalAmount,
            affectsTaxBase: charges[i].isIncludedInTaxBase(),
            affectsGrandTotal: true,
          });
        }
      }
    }

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

    const chargeItems: ChargeItem[] = Array.from(chargeAccumulator.values());
    const taxes: TaxLineItem[] = Array.from(taxAccumulator.values());
    const modifierType = rules.length > 0 ? (rules[0].getModifier()?.type ?? 'none') : 'none';

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

  private calculateGlobalCharges(charges: Charge[], exclusiveTaxable: number): number[] {
    const amounts: number[] = [];
    let base = exclusiveTaxable;
    for (const charge of charges) {
      const amount = charge.calculate(base);
      amounts.push(amount);
      if (charge.isIncludedInTaxBase()) {
        base += amount;
      }
    }
    return amounts;
  }

  private accumulateTax(
    map: Map<string, { name: string; rate: number; amount: number }>,
    rule: TaxRule,
    amount: number,
  ): void {
    const key = rule.getId();
    const existing = map.get(key);
    if (existing) {
      existing.amount += amount;
    } else {
      map.set(key, { name: rule.getName(), rate: rule.getPolicy().getValue(), amount });
    }
  }

  private accumulateCharge(
    map: Map<string, { name: string; amount: number; includeInTaxBase: boolean }>,
    charge: Charge,
    amount: number,
  ): void {
    const key = charge.getId();
    const existing = map.get(key);
    if (existing) {
      existing.amount += amount;
    } else {
      map.set(key, { name: charge.getName(), amount, includeInTaxBase: charge.isIncludedInTaxBase() });
    }
  }

  private accumulateChargeRaw(
    map: Map<string, { name: string; amount: number; includeInTaxBase: boolean }>,
    charge: Charge,
    amount: number,
  ): void {
    const key = charge.getId();
    const existing = map.get(key);
    if (existing) {
      existing.amount += amount;
    } else {
      map.set(key, { name: charge.getName(), amount, includeInTaxBase: charge.isIncludedInTaxBase() });
    }
  }

  private calcDiscount(
    subtotal: number,
    discount: number,
    discountType?: 'percentage' | 'nominal',
  ): number {
    if (discount <= 0) return 0;
    if (discountType === 'percentage') {
      return subtotal * (Math.min(discount, 100) / 100);
    }
    return Math.min(discount, subtotal);
  }

  private emptyResult(input: PricingInput): PricingResult {
    const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const discountAmount = this.calcDiscount(subtotal, input.discount ?? 0, input.discountType);
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
}
