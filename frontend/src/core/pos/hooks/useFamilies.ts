import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

interface Family {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

interface FamiliesResponse {
  success: boolean;
  data: Family[];
}

async function fetchFamilies(): Promise<Family[]> {
  const res = await api.get<FamiliesResponse>('/families');
  return res.data.data;
}

export function useFamilies() {
  return useQuery({
    queryKey: ['families'],
    queryFn: fetchFamilies,
    staleTime: 30_000,
  });
}
