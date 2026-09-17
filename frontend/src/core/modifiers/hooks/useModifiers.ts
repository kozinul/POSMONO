import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  isActive: boolean;
}

export type ModifierDisplayType = 'radio' | 'checkbox' | 'stepper';

export interface ModifierGroup {
  id: string;
  tenantId: string;
  productId: string | null;
  familyId: string | null;
  name: string;
  displayType: ModifierDisplayType;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
  required: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useModifiers() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['modifiers'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ModifierGroup[] }>('/modifiers');
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<ModifierGroup>) => {
      const res = await api.post<{ success: boolean; data: ModifierGroup }>('/modifiers', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifiers'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ModifierGroup> }) => {
      const res = await api.put<{ success: boolean; data: ModifierGroup }>(`/modifiers/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifiers'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/modifiers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifiers'] });
    },
  });

  return {
    ...query,
    modifiers: query.data || [],
    createModifier: createMutation.mutateAsync,
    updateModifier: updateMutation.mutateAsync,
    deleteModifier: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
