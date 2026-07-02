import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// --- Backend response types ---

export interface IModifierConfig {
  type: 'none' | 'fraction' | 'multiplier' | 'fixed_deduction';
  config?: {
    numerator?: number;
    denominator?: number;
    multiplier?: number;
    deduction?: number;
  };
}

export interface ITaxRule {
  id: string;
  name: string;
  taxType: 'vat' | 'withholding' | 'service_charge' | 'custom' | 'exemption';
  scope: { type: string; entityId: string; entityName: string };
  policy: {
    type: string;
    value: number;
    roundingMode: 'round' | 'floor' | 'ceil';
    precision: number;
  };
  modifier?: IModifierConfig;
  priority: number;
  isActive: boolean;
  effectiveDate: string;
  expiresAt?: string;
  conditions?: Record<string, unknown>;
}

export interface ITaxVersion {
  id: string;
  versionNumber: number;
  effectiveDate: string;
  rules: ITaxRule[];
  status: 'draft' | 'active' | 'deprecated';
  createdAt: string;
  deprecatedAt?: string;
}

export interface ITaxConfiguration {
  id: string;
  tenantId: string;
  taxEnabled: boolean;
  pricingMode: 'inclusive' | 'exclusive';
  countryCode: string;
  currency: string;
  activeVersionId: string;
  versions: ITaxVersion[];
  createdAt?: string;
  updatedAt?: string;
}

// --- Hooks ---

export function useTaxConfiguration() {
  return useQuery<ITaxConfiguration>({
    queryKey: ['tax-configuration'],
    queryFn: async () => {
      const { data } = await api.get('/tax/configuration');
      return data;
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
      const { data } = await api.put('/tax/configuration', settings);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-configuration'] }),
  });
}

export function useAddTaxRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: ITaxRule) => {
      const { data } = await api.post('/tax/rules', rule);
      return data;
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
    mutationFn: async (input: {
      tenantId: string;
      items: Array<{
        id?: string;
        productId: string;
        productName?: string;
        quantity: number;
        unitPrice: number;
        categoryId?: string;
      }>;
      discount?: number;
      discountType?: 'percentage' | 'nominal';
      outletId?: string;
      transactionType?: string;
      customerTags?: string[];
    }) => {
      const { data } = await api.post('/tax/calculate', input);
      return data;
    },
  });
}
