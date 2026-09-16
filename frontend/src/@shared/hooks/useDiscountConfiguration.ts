import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../services/api';

interface IDiscountCondition {
  type: 'min_purchase' | 'min_items' | 'category_match' | 'product_match' | 'day_of_week' | 'date_range' | 'quantity_threshold' | 'time_range' | 'customer_tag';
  config: Record<string, unknown>;
}

interface IDiscountEffect {
  type: 'percentage_off' | 'nominal_off' | 'free_item' | 'fixed_price' | 'bundle_price' | 'buy_x_pay_y' | 'buy_x_get_y';
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

export function useDiscountConfiguration() {
  return useQuery<IDiscountConfiguration>({
    queryKey: ['discount-config'],
    queryFn: async () => {
      const { data } = await api.get('/discount');
      return data;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
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
