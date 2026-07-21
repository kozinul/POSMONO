import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface PaymentMethod {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  requiresReference: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface PaymentMethodsResponse {
  success: boolean;
  data: PaymentMethod[];
}

async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const res = await api.get<PaymentMethodsResponse>('/payment-methods');
  return res.data.data;
}

async function fetchActivePaymentMethods(): Promise<PaymentMethod[]> {
  const res = await api.get<PaymentMethodsResponse>('/payment-methods/active');
  return res.data.data;
}

async function createPaymentMethod(data: Partial<PaymentMethod>): Promise<PaymentMethod> {
  const res = await api.post<{ success: boolean; data: PaymentMethod }>('/payment-methods', data);
  return res.data.data;
}

async function updatePaymentMethod(id: string, data: Partial<PaymentMethod>): Promise<PaymentMethod> {
  const res = await api.put<{ success: boolean; data: PaymentMethod }>(`/payment-methods/${id}`, data);
  return res.data.data;
}

async function deletePaymentMethod(id: string): Promise<void> {
  await api.delete(`/payment-methods/${id}`);
}

export function usePaymentMethodList() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: fetchPaymentMethods,
    staleTime: 30_000,
  });
}

export function useActivePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods', 'active'],
    queryFn: fetchActivePaymentMethods,
    staleTime: 30_000,
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PaymentMethod> }) => updatePaymentMethod(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });
}
