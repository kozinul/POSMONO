import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface Hub {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useHubs() {
  return useQuery({
    queryKey: ['hubs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Hub[] }>('/hubs');
      return res.data.data;
    },
    staleTime: 60_000,
    retry: false,
  });
}