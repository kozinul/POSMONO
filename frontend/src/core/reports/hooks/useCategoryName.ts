import { useMemo } from 'react';
import { useCategories } from '../../pos/hooks/useProducts';

export function useCategoryName(): (categoryId: string | null) => string {
  const { data: categories = [] } = useCategories();
  return useMemo(
    () => (categoryId: string | null) =>
      categoryId
        ? categories.find((c) => c.id === categoryId)?.name || 'Lainnya'
        : 'Tanpa kategori',
    [categories],
  );
}
