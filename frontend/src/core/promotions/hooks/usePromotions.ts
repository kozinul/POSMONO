import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface PromotionRule {
  type: string;
  params: Record<string, unknown>;
}

export interface PromotionEffect {
  type: string;
  value: number;
  target: string;
  targetProductId?: string;
  maxDiscount?: number;
}

export interface Promotion {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string;
  priority: number;
  exclusive: boolean;
  stackable: boolean;
  ruleLogic: string;
  rules: PromotionRule[];
  effects: PromotionEffect[];
  usageLimit: number | null;
  usedCount: number;
  minPurchase: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PromotionsResponse {
  success: boolean;
  data: Promotion[];
  meta: { total: number; page: number; limit: number };
}

export function usePromotions(params?: { page?: number; limit?: number; isActive?: boolean }) {
  return useQuery({
    queryKey: ['promotions', params],
    queryFn: async () => {
      const res = await api.get<PromotionsResponse>('/promotions', { params });
      return res.data;
    },
  });
}

export function usePromotion(id: string) {
  return useQuery({
    queryKey: ['promotions', id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Promotion }>(`/promotions/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Promotion, 'id' | 'tenantId' | 'usedCount' | 'createdAt' | 'updatedAt'>) => {
      const res = await api.post('/promotions', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  });
}

export function useUpdatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Promotion>) => {
      const res = await api.put(`/promotions/${id}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  });
}

export function useDeletePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/promotions/${id}`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promotions'] }),
  });
}

export function useValidatePromotion() {
  return useMutation({
    mutationFn: async (data: { code: string; subtotal: number; itemCount: number; productIds?: string[]; categoryIds?: string[]; customerTags?: string[] }) => {
      const res = await api.post('/promotions/validate', data);
      return res.data;
    },
  });
}
