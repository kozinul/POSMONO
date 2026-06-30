import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

interface Product {
  id: string;
  name: string;
  basePrice: number;
  imageUrls: string[];
  categoryId: string;
  isActive: boolean;
  barcode: string;
  sku: string;
  description: string;
  tags: string[];
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

interface ProductsResponse {
  success: boolean;
  data: Product[];
  meta: { total: number; page: number; limit: number };
}

interface CategoriesResponse {
  success: boolean;
  data: Category[];
}

async function fetchProducts(search?: string, categoryId?: string): Promise<Product[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (search) params.set('search', search);
  if (categoryId) params.set('categoryId', categoryId);
  const res = await api.get<ProductsResponse>(`/api/products?${params}`);
  return res.data.data;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await api.get<CategoriesResponse>('/api/categories');
  return res.data.data;
}

export function useProducts(search?: string, categoryId?: string) {
  return useQuery({
    queryKey: ['products', search, categoryId],
    queryFn: () => fetchProducts(search, categoryId),
    staleTime: 15_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 30_000,
  });
}
