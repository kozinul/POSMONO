import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export type MenuType = string;

interface Family {
  id: string;
  name: string;
  description: string;
  menuType: string;
  sortOrder: number;
  isActive: boolean;
}

interface FamiliesResponse {
  success: boolean;
  data: Family[];
}

async function fetchFamilies(menuType?: string): Promise<Family[]> {
  const url = menuType ? `/families/by-menu-type/${encodeURIComponent(menuType)}` : '/families';
  const res = await api.get<FamiliesResponse>(url);
  return res.data.data;
}

export function useFamilies(menuType?: string) {
  return useQuery({
    queryKey: ['families', menuType],
    queryFn: () => fetchFamilies(menuType),
    staleTime: 30_000,
  });
}
