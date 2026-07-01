import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export function useTenant() {
  return useQuery<Tenant>({
    queryKey: ['tenant'],
    queryFn: async () => {
      const { data } = await api.get('/tenants/current');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
