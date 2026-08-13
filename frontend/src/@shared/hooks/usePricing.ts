import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';

export interface PricingLineItem {
  productId: string;
  productName: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice: number;
  discount: number;
  lineTotal: number;
  isFreeItem: boolean;
  freeByRuleId?: string;
}

export interface PricingResult {
  originalSubtotal: number;
  promotionDiscount: number;
  netSubtotal: number;
  serviceCharge: number;
  serviceChargeName: string;
  taxBase: number;
  tax: number;
  taxName: string;
  taxRate: number;
  rounding: number;
  grandTotal: number;
  roundedPayable: number;
  lineItems: PricingLineItem[];
  adjustments: Array<{
    id: string;
    type: string;
    name: string;
    sequence: number;
    base: number;
    rate?: number;
    amount: number;
    affectsTaxBase: boolean;
    affectsGrandTotal: boolean;
  }>;
  appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    discountAmount: number;
    description: string;
  }>;
}

export function useCalculatePricing() {
  return useMutation({
    mutationFn: async (input: {
      items: Array<{
        productId: string;
        productName: string;
        categoryId: string;
        quantity: number;
        unitPrice: number;
        pricingMode?: 'inclusive' | 'exclusive';
      }>;
      promoCode?: string;
      customerGroupId?: string;
      manualDiscount?: number;
      manualDiscountType?: 'percentage' | 'nominal';
    }) => {
      const { data } = await api.post('/pricing/calculate', input);
      return data as PricingResult;
    },
  });
}
