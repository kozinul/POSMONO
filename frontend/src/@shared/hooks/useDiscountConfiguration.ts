import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export interface IDiscountCondition {
  type: 'min_purchase' | 'min_items' | 'category_match' | 'product_match' | 'day_of_week' | 'date_range' | 'quantity_threshold';
  config: Record<string, unknown>;
}

export interface IDiscountEffect {
  type: 'percentage_off' | 'nominal_off' | 'free_item' | 'fixed_price' | 'bundle_price';
  config: Record<string, unknown>;
}

export interface IDiscountRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  stackable: boolean;
  active: boolean;
  scope: { type: string; entityId: string; entityName: string };
  policy: {
    type: string;
    value: number;
    maxCap?: number;
    application: string;
    roundingMode: string;
    precision: number;
  };
  conditions: IDiscountCondition[];
  effects: IDiscountEffect[];
  promoCodeId?: string;
  maxUsageCount?: number;
  currentUsageCount: number;
  startDate?: string;
  endDate?: string;
}

export interface IDiscountConfiguration {
  id: string;
  tenantId: string;
  enabled: boolean;
  rules: IDiscountRule[];
  createdAt: string;
  updatedAt: string;
}

export interface IDiscountResult {
  totalDiscount: number;
  appliedRules: Array<{ ruleId: string; ruleName: string; discountAmount: number; description: string }>;
  freeItems: Array<{ productId: string; quantity: number }>;
  finalSubtotal: number;
  breakdown: Array<{ ruleId: string; ruleName: string; discountAmount: number; description: string }>;
}

export function useDiscountConfiguration() {
  return useQuery<IDiscountConfiguration>({
    queryKey: ['discount-config'],
    queryFn: async () => {
      const { data } = await api.get('/discount');
      return data;
    },
  });
}

export function useToggleDiscountEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data } = await api.put('/discount/toggle', { enabled });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-config'] }),
  });
}

export function useAddDiscountRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: IDiscountRule) => {
      const { data } = await api.post('/discount/rules', rule);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-config'] }),
  });
}

export function useUpdateDiscountRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rule }: IDiscountRule) => {
      const { data } = await api.put(`/discount/rules/${id}`, rule);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-config'] }),
  });
}

export function useDeleteDiscountRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      await api.delete(`/discount/rules/${ruleId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-config'] }),
  });
}

export function useCalculateDiscount() {
  return useMutation({
    mutationFn: async (input: {
      tenantId: string;
      items: Array<{ productId: string; categoryId: string; quantity: number; unitPrice: number }>;
      promoCode?: string;
    }) => {
      const { data } = await api.post('/discount/calculate', input);
      return data as IDiscountResult;
    },
  });
}

export function useValidatePromoCode() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await api.post('/discount/validate-promo', { code });
      return data as { valid: boolean; ruleName?: string; error?: string };
    },
  });
}
