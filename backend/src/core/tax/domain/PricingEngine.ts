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
    const taxableAmount = subtotal - discountAmount;

    const ctx: ScopeMatchContext = {
      items: input.items,
      outletId: input.outletId,
      transactionType: input.transactionType,
      customerTags: input.customerTags,
    };

    let rules = config
      .getActiveRules()
      .filter((r) => r.shouldApply(ctx));

    if (allowedRuleIds) {
      const idSet = new Set(allowedRuleIds);
      rules = rules.filter((r) => idSet.has(r.getId()));
    }

    rules.sort((a, b) => a.getPriority() - b.getPriority());

    const taxBreakdown: TaxBreakdownItem[] = [];
    let totalTax = 0;
    let serviceCharge = 0;
    let dppBase = taxableAmount;

    for (const rule of rules) {
      const base = rule.isExemption() ? 0 : dppBase;
      const taxAmount = this.calculateRuleTax(rule, dppBase);

      taxBreakdown.push({
        ruleId: rule.getId(),
        name: rule.getName(),
        taxType: rule.getTaxType(),
        rate: rule.getPolicy().getValue(),
        amount: taxAmount,
        baseAmount: base,
        priority: rule.getPriority(),
      });

      totalTax += taxAmount;
      if (rule.isServiceCharge()) {
        serviceCharge += taxAmount;
        dppBase += taxAmount;
      }
    }

    const grandTotal =
      config.getPricingMode() === 'inclusive'
        ? subtotal + serviceCharge
        : subtotal + totalTax;

    return {
      subtotal,
      discount: input.discount ?? 0,
      discountType: input.discountType ?? 'nominal',
      discountAmount,
      taxableAmount,
      taxBreakdown,
      totalTax,
      serviceCharge,
      grandTotal,
    };
  }

  calculateRuleTax(rule: TaxRule, taxableAmount: number): number {
    return rule.calculateTax(taxableAmount);
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
