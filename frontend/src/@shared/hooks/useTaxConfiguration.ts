import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export type TaxCalculationStrategy = 'standard_percentage' | 'indonesia_ppn_2025' | 'compound';

export interface TaxRule {
  id: string;
  name: string;
  type: 'percentage' | 'compound' | 'category_based' | 'product_based' | 'exemption';
  rate: number;
  compoundOrder: number;
  calculationStrategy: TaxCalculationStrategy;
  taxBaseModifier: string | null;
  applyTo: 'all' | 'categories' | 'products' | 'exempt';
  categoryIds: string[];
  productIds: string[];
  exemptProductIds: string[];
  exemptCustomerTags: string[];
  isActive: boolean;
}

export interface TaxConfiguration {
  id: string;
  tenantId: string;
  taxEnabled: boolean;
  pricingMode: 'inclusive' | 'exclusive';
  countryCode: string;
  currency: string;
  rules: TaxRule[];
  version: number;
}

export interface TaxCalculateInput {
  items: Array<{
    productId: string;
    productName?: string;
    quantity: number;
    unitPrice: number;
    categoryId?: string;
  }>;
  discount?: number;
  discountType?: 'percentage' | 'nominal';
  customerTags?: string[];
}

export interface TaxCalculationResult {
  subtotal: number;
  discount: number;
  discountAmount: number;
  taxableAmount: number;
  taxes: Array<{
    name: string;
    type: string;
    rate: number;
    calculationStrategy: TaxCalculationStrategy;
    taxBaseModifier: string | null;
    baseAmount: number;
    amount: number;
    compoundOrder: number;
  }>;
  totalTax: number;
  serviceCharge: number;
  grandTotal: number;
  pricingMode: string;
}

export function useTaxConfiguration() {
  return useQuery<TaxConfiguration>({
    queryKey: ['tax-configuration'],
    queryFn: async () => {
      const { data } = await api.get('/tax/configuration');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateTaxConfiguration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<{
      taxEnabled: boolean;
      pricingMode: 'inclusive' | 'exclusive';
      countryCode: string;
      currency: string;
    }>) => {
      const { data } = await api.patch('/tax/configuration', settings);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-configuration'] }),
  });
}

export function useAddTaxRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<TaxRule, 'id'>) => {
      const { data } = await api.post('/tax/rules', rule);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-configuration'] }),
  });
}

export function useDeleteTaxRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      await api.delete(`/tax/rules/${ruleId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-configuration'] }),
  });
}

export function useCalculateTax() {
  return useMutation({
    mutationFn: async (input: TaxCalculateInput) => {
      const { data } = await api.post('/tax/calculate', input);
      return data.data as TaxCalculationResult;
    },
  });
}
