import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export type MenuType = 'food' | 'beverage';

interface Family {
  id: string;
  name: string;
  description: string;
  menuType: MenuType;
  sortOrder: number;
  isActive: boolean;
}

interface FamiliesResponse {
  success: boolean;
  data: Family[];
}

async function fetchFamilies(menuType?: MenuType): Promise<Family[]> {
  const url = menuType ? `/families/by-menu-type/${menuType}` : '/families';
  const res = await api.get<FamiliesResponse>(url);
  return res.data.data;
}

export function useFamilies(menuType?: MenuType) {
  return useQuery({
    queryKey: ['families', menuType],
    queryFn: () => fetchFamilies(menuType),
    staleTime: 30_000,
  });
}
