export type TaxPricingMode = 'inclusive' | 'exclusive';
export type TaxRuleType = 'percentage' | 'compound' | 'category_based' | 'product_based' | 'exemption';
export type TaxApplyTo = 'all' | 'categories' | 'products' | 'exempt';

/**
 * Strategi kalkulasi pajak:
 * - standard_percentage : tax = base × rate%
 * - indonesia_ppn_2025  : DPP Nilai Lain — DPP = base × 11/12, tax = DPP × rate%  (efektif 11% walau rate 12%)
 * - compound            : tax dihitung berantai sesuai compoundOrder
 */
export type TaxCalculationStrategy = 'standard_percentage' | 'indonesia_ppn_2025' | 'compound';

export interface TaxRule {
  id: string;
  name: string;
  type: TaxRuleType;
  rate: number;
  compoundOrder: number;
  calculationStrategy: TaxCalculationStrategy;
  taxBaseModifier: string | null;
  applyTo: TaxApplyTo;
  categoryIds: string[];
  productIds: string[];
  exemptProductIds: string[];
  exemptCustomerTags: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface TaxConfiguration {
  id: string;
  tenantId: string;
  taxEnabled: boolean;
  pricingMode: TaxPricingMode;
  countryCode: string;
  currency: string;
  rules: TaxRule[];
  version: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxCalculationItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  categoryId: string;
  totalPrice: number;
}

export interface TaxBreakdownItem {
  name: string;
  type: TaxRuleType;
  rate: number;
  calculationStrategy: TaxCalculationStrategy;
  taxBaseModifier: string | null;
  baseAmount: number;
  amount: number;
  compoundOrder: number;
}

export interface TaxCalculationResult {
  subtotal: number;
  discount: number;
  discountAmount: number;
  taxableAmount: number;
  taxes: TaxBreakdownItem[];
  totalTax: number;
  serviceCharge: number;
  grandTotal: number;
  pricingMode: TaxPricingMode;
}

export interface TaxTransactionRecord {
  id: string;
  tenantId: string;
  orderId: string;
  configSnapshot: TaxConfiguration;
  result: TaxCalculationResult;
  calculationVersion: number;
  createdAt: Date;
}
