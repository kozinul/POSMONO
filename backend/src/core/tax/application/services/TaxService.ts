import {
  TaxConfiguration,
  TaxPricingMode,
  ITaxConfiguration,
} from '../../domain/TaxConfiguration';
import { TaxRule, ITaxRule, TaxRuleType } from '../../domain/TaxRule';
import { TaxTransactionRecord, TaxCalculationResult, TaxBreakdownItem, ITaxRuleSnapshot } from '../../domain/TaxTransactionRecord';
import { TaxConfigurationRepository } from '../../infrastructure/persistence/repositories/MongoTaxConfigurationRepository';
import { TaxTransactionRecordRepository } from '../../infrastructure/persistence/repositories/MongoTaxTransactionRecordRepository';

export interface TaxCalculateInput {
  tenantId: string;
  items: TaxCalculateItem[];
  discount?: number;
  discountType?: 'percentage' | 'nominal';
  customerTags?: string[];
  orderId?: string;
}

export interface TaxCalculateItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  categoryId: string;
}

export interface TaxValidateInput {
  rules: ITaxRule[];
}

export interface TaxValidationError {
  field: string;
  message: string;
}

export interface TaxServiceConfig {
  roundingMode: 'round' | 'floor' | 'ceil';
  decimalPlaces: number;
}

const DEFAULT_CONFIG: TaxServiceConfig = {
  roundingMode: 'round',
  decimalPlaces: 0,
};

export class TaxService {
  private configRepo: TaxConfigurationRepository;
  private recordRepo: TaxTransactionRecordRepository;
  private engineConfig: TaxServiceConfig;

  constructor(
    configRepo: TaxConfigurationRepository,
    recordRepo: TaxTransactionRecordRepository,
    engineConfig?: Partial<TaxServiceConfig>,
  ) {
    this.configRepo = configRepo;
    this.recordRepo = recordRepo;
    this.engineConfig = { ...DEFAULT_CONFIG, ...engineConfig };
  }

  async calculate(input: TaxCalculateInput): Promise<TaxCalculationResult> {
    const config = await this.configRepo.findByTenantIdOrFail(input.tenantId);
    return this.calculateFromConfig(config, input);
  }

  calculateFromConfig(config: TaxConfiguration, input: TaxCalculateInput): TaxCalculationResult {
    const customerTags = input.customerTags ?? [];
    const discount = input.discount ?? 0;
    const discountType = input.discountType ?? 'nominal';

    const subtotal = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    const discountAmount = this.applyDiscount(subtotal, discount, discountType);
    const taxableAmount = subtotal - discountAmount;

    const { compoundBase, compoundTaxes, allAppliedRules } = this.applyCompoundTaxes(
      config,
      taxableAmount,
      input.items,
      customerTags,
    );

    const simpleTaxes = this.applySimpleTaxes(
      config,
      compoundBase,
      taxableAmount,
      input.items,
      customerTags,
    );

    const allTaxes = [...compoundTaxes, ...simpleTaxes];
    const totalTax = this.round(allTaxes.reduce((sum, t) => sum + t.amount, 0));
    const serviceCharge = compoundTaxes
      .filter((t) => t.type === 'compound')
      .reduce((sum, t) => sum + t.amount, 0);
    const grandTotal = this.round(taxableAmount + totalTax);

    const result: TaxCalculationResult = {
      subtotal,
      discount,
      discountType,
      discountAmount,
      taxableAmount,
      taxes: allTaxes,
      totalTax,
      serviceCharge,
      grandTotal,
      pricingMode: config.getPricingMode(),
    };

    if (input.orderId) {
      this.persistCalculation(input.tenantId, input.orderId, allAppliedRules, result, config);
    }

    return result;
  }

  validateRules(input: TaxValidateInput): TaxValidationError[] {
    const errors: TaxValidationError[] = [];

    for (let i = 0; i < input.rules.length; i++) {
      const rule = input.rules[i];

      if (!rule.name || rule.name.trim().length === 0) {
        errors.push({ field: `rules[${i}].name`, message: 'Rule name is required' });
      }

      if (rule.rate < 0 || rule.rate > 100) {
        errors.push({ field: `rules[${i}].rate`, message: 'Rate must be between 0 and 100' });
      }

      if (rule.type === 'category_based' && (!rule.categoryIds || rule.categoryIds.length === 0)) {
        errors.push({ field: `rules[${i}].categoryIds`, message: 'Category-based rules must specify at least one category' });
      }

      if (rule.type === 'product_based' && (!rule.productIds || rule.productIds.length === 0)) {
        errors.push({ field: `rules[${i}].productIds`, message: 'Product-based rules must specify at least one product' });
      }

      if (rule.type === 'compound' && rule.compoundOrder < 0) {
        errors.push({ field: `rules[${i}].compoundOrder`, message: 'Compound order must be non-negative' });
      }

      if (rule.type === 'exemption' && rule.applyTo !== 'exempt') {
        errors.push({ field: `rules[${i}].applyTo`, message: 'Exemption rules must use applyTo="exempt"' });
      }
    }

    return errors;
  }

  applyDiscount(subtotal: number, discount: number, discountType: 'percentage' | 'nominal'): number {
    if (discount <= 0) return 0;

    if (discountType === 'percentage') {
      const pct = Math.min(discount, 100);
      return this.round(subtotal * (pct / 100));
    }

    return this.round(Math.min(discount, subtotal));
  }

  private applyCompoundTaxes(
    config: TaxConfiguration,
    taxableAmount: number,
    items: TaxCalculateItem[],
    customerTags: string[],
  ): {
    compoundBase: number;
    compoundTaxes: TaxBreakdownItem[];
    allAppliedRules: ITaxRuleSnapshot[];
  } {
    const compoundRules = config.getCompoundRules();
    const allAppliedRules: ITaxRuleSnapshot[] = [];
    const compoundTaxes: TaxBreakdownItem[] = [];
    let compoundBase = taxableAmount;

    for (const rule of compoundRules) {
      const ruleData = rule.serialize();
      allAppliedRules.push({
        id: ruleData.id ?? '',
        name: ruleData.name,
        type: ruleData.type,
        rate: ruleData.rate,
        compoundOrder: ruleData.compoundOrder,
        calculationStrategy: ruleData.calculationStrategy,
        taxBaseModifier: ruleData.taxBaseModifier,
      });

      const baseForThisRule = this.calculateBaseForRule(
        rule,
        taxableAmount,
        compoundBase,
        items,
        customerTags,
      );

      const amount = this.calculateTaxAmount(baseForThisRule, rule);

      compoundTaxes.push({
        name: ruleData.name,
        type: ruleData.type,
        rate: ruleData.rate,
        calculationStrategy: ruleData.calculationStrategy,
        taxBaseModifier: ruleData.taxBaseModifier,
        baseAmount: baseForThisRule,
        amount,
        compoundOrder: ruleData.compoundOrder,
      });

      compoundBase = this.round(compoundBase + amount);
    }

    return { compoundBase, compoundTaxes, allAppliedRules };
  }

  private applySimpleTaxes(
    config: TaxConfiguration,
    compoundBase: number,
    taxableAmount: number,
    items: TaxCalculateItem[],
    customerTags: string[],
  ): TaxBreakdownItem[] {
    const simpleRules = config.getSimpleRules();
    const taxes: TaxBreakdownItem[] = [];

    for (const rule of simpleRules) {
      const ruleData = rule.serialize();
      const baseForThisRule = this.calculateBaseForRule(
        rule,
        taxableAmount,
        compoundBase,
        items,
        customerTags,
      );

      const amount = this.calculateTaxAmount(baseForThisRule, rule);

      taxes.push({
        name: ruleData.name,
        type: ruleData.type,
        rate: ruleData.rate,
        calculationStrategy: ruleData.calculationStrategy,
        taxBaseModifier: ruleData.taxBaseModifier,
        baseAmount: baseForThisRule,
        amount,
        compoundOrder: ruleData.compoundOrder,
      });
    }

    return taxes;
  }

  private calculateBaseForRule(
    rule: TaxRule,
    taxableAmount: number,
    compoundBase: number,
    items: TaxCalculateItem[],
    customerTags: string[],
  ): number {
    const ruleData = rule.serialize();

    if (ruleData.applyTo === 'all') {
      return rule.isCompound() ? compoundBase : taxableAmount;
    }

    let applicableTotal = 0;
    for (const item of items) {
      if (rule.appliesTo(item.productId, item.categoryId, customerTags)) {
        const ratio = taxableAmount > 0 ? (item.quantity * item.unitPrice) / taxableAmount : 0;
        const allocatedBase = taxableAmount * ratio;
        applicableTotal += this.round(allocatedBase);
      }
    }

    if (rule.isCompound()) {
      const compoundRatio = taxableAmount > 0 ? applicableTotal / taxableAmount : 0;
      return this.round(compoundBase * compoundRatio);
    }

    return applicableTotal;
  }

  private async persistCalculation(
    tenantId: string,
    orderId: string,
    appliedRules: ITaxRuleSnapshot[],
    result: TaxCalculationResult,
    config: TaxConfiguration,
  ): Promise<void> {
    const record = TaxTransactionRecord.create(
      tenantId,
      orderId,
      appliedRules,
      result,
      config.serialize().version,
    );
    await this.recordRepo.save(record);
  }

  private calculateTaxAmount(base: number, rule: TaxRule): number {
    const ruleData = rule.serialize();
    let effectiveBase = base;

    // 1. Apply taxBaseModifier jika ada (misal "11/12")
    if (ruleData.taxBaseModifier) {
      effectiveBase = this.evaluateModifier(base, ruleData.taxBaseModifier);
    } else {
      // 2. Fallback ke calculationStrategy
      switch (ruleData.calculationStrategy) {
        case 'indonesia_ppn_2025':
          // DPP Nilai Lain: DPP = base × 11/12
          effectiveBase = this.round(base * (11 / 12));
          break;
        case 'compound':
        case 'standard_percentage':
        default:
          effectiveBase = base;
          break;
      }
    }

    return this.round(effectiveBase * (ruleData.rate / 100));
  }

  private evaluateModifier(base: number, modifier: string): number {
    // Evaluasi modifier sederhana seperti "11/12", "0.8", "2/3"
    const trimmed = modifier.trim();

    const fractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fractionMatch) {
      const num = parseInt(fractionMatch[1], 10);
      const den = parseInt(fractionMatch[2], 10);
      if (den !== 0) {
        return this.round(base * (num / den));
      }
    }

    const decimal = parseFloat(trimmed);
    if (!isNaN(decimal)) {
      return this.round(base * decimal);
    }

    return base;
  }

  private round(value: number): number {
    const factor = Math.pow(10, this.engineConfig.decimalPlaces);
    const mode = this.engineConfig.roundingMode;

    switch (mode) {
      case 'floor':
        return Math.floor(value * factor) / factor;
      case 'ceil':
        return Math.ceil(value * factor) / factor;
      case 'round':
      default:
        return Math.round(value * factor) / factor;
    }
  }
}
