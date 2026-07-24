import { TaxConfiguration } from './TaxConfiguration';
import { TaxRule } from './TaxRule';
import { ScopeMatchContext } from './TaxScope';

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

export interface TaxBreakdownItem {
  ruleId: string;
  name: string;
  taxType: string;
  rate: number;
  amount: number;
  baseAmount: number;
  priority: number;
}

export interface PricingResult {
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

export class PricingEngine {
  calculate(input: PricingInput, config: TaxConfiguration, allowedRuleIds?: string[]): PricingResult {
    if (!config.isTaxEnabled()) {
      return this.emptyResult(input);
    }

    const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const discountAmount = this.calcDiscount(subtotal, input.discount ?? 0, input.discountType);
    const globalMode = config.getPricingMode();

    const ctx: ScopeMatchContext = {
      items: input.items,
      outletId: input.outletId,
      transactionType: input.transactionType,
      customerTags: input.customerTags,
    };

    let rules = config.getActiveRules().filter((r) => r.shouldApply(ctx));

    if (allowedRuleIds) {
      const idSet = new Set(allowedRuleIds);
      rules = rules.filter((r) => idSet.has(r.getId()));
    }

    rules.sort((a, b) => a.getPriority() - b.getPriority());

    const scRules = rules.filter((r) => r.isServiceCharge());
    const taxRules = rules.filter((r) => !r.isServiceCharge());

    const exclusiveSubtotal = input.items.reduce((sum, item) => {
      const mode = item.pricingMode ?? globalMode;
      if (mode === 'exclusive') return sum + item.quantity * item.unitPrice;
      return sum;
    }, 0);
    const exclusiveDiscount = subtotal > 0 ? (exclusiveSubtotal / subtotal) * discountAmount : 0;
    const exclusiveTaxable = exclusiveSubtotal - exclusiveDiscount;

    let globalSC = 0;
    const scBreakdown: TaxBreakdownItem[] = [];
    let scDppBase = exclusiveTaxable;
    for (const rule of scRules) {
      const taxAmount = this.calculateRuleTax(rule, scDppBase, false);
      scBreakdown.push({
        ruleId: rule.getId(),
        name: rule.getName(),
        taxType: rule.getTaxType(),
        rate: rule.getPolicy().getValue(),
        amount: taxAmount,
        baseAmount: scDppBase,
        priority: rule.getPriority(),
      });
      globalSC += taxAmount;
      scDppBase += taxAmount;
    }

    const taxBreakdown: TaxBreakdownItem[] = [...scBreakdown];
    let totalTax = globalSC;
    let totalDpp = 0;
    let grandTotal = 0;

    for (const item of input.items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = subtotal > 0 ? (itemSubtotal / subtotal) * discountAmount : 0;
      const itemAmount = itemSubtotal - itemDiscount;
      const isInclusive = (item.pricingMode ?? globalMode) === 'inclusive';

      if (isInclusive) {
        const dpp = this.extractInclusiveDPP(itemAmount, taxRules);
        totalDpp += dpp;
        const itemTax = itemAmount - dpp;
        totalTax += itemTax;
        grandTotal += itemSubtotal;

        for (const rule of taxRules) {
          taxBreakdown.push({
            ruleId: rule.getId(),
            name: rule.getName(),
            taxType: rule.getTaxType(),
            rate: rule.getPolicy().getValue(),
            amount: this.calculateRuleTax(rule, itemAmount, true),
            baseAmount: Math.round(dpp),
            priority: rule.getPriority(),
          });
        }
      } else {
        const itemSC = exclusiveTaxable > 0 ? (itemAmount / exclusiveTaxable) * globalSC : 0;
        const dpp = itemAmount + itemSC;
        totalDpp += dpp;

        let itemTax = 0;
        for (const rule of taxRules) {
          const taxAmount = this.calculateRuleTax(rule, dpp, false);
          itemTax += taxAmount;
          taxBreakdown.push({
            ruleId: rule.getId(),
            name: rule.getName(),
            taxType: rule.getTaxType(),
            rate: rule.getPolicy().getValue(),
            amount: taxAmount,
            baseAmount: Math.round(dpp),
            priority: rule.getPriority(),
          });
        }
        totalTax += itemTax;
        grandTotal += itemAmount + itemSC + itemTax;
      }
    }

    const aggregatedMap = new Map<string, TaxBreakdownItem>();
    for (const entry of taxBreakdown) {
      const existing = aggregatedMap.get(entry.ruleId);
      if (existing) {
        existing.amount += entry.amount;
        existing.baseAmount += entry.baseAmount;
      } else {
        aggregatedMap.set(entry.ruleId, { ...entry });
      }
    }

    return {
      subtotal,
      discount: input.discount ?? 0,
      discountType: input.discountType ?? 'nominal',
      discountAmount,
      taxableAmount: totalDpp,
      taxBreakdown: Array.from(aggregatedMap.values()),
      totalTax,
      serviceCharge: globalSC,
      grandTotal,
    };
  }

  private extractInclusiveDPP(price: number, taxRules: TaxRule[]): number {
    let totalTax = 0;
    for (const rule of taxRules) {
      totalTax += this.calculateRuleTax(rule, price, true);
    }
    return price - totalTax;
  }

  calculateRuleTax(rule: TaxRule, taxableAmount: number, isInclusive = false): number {
    return rule.calculateTax(taxableAmount, isInclusive);
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
    return {
      subtotal: 0,
      discount: input.discount ?? 0,
      discountType: input.discountType ?? 'nominal',
      discountAmount: 0,
      taxableAmount: 0,
      taxBreakdown: [],
      totalTax: 0,
      serviceCharge: 0,
      grandTotal: 0,
    };
  }
}
