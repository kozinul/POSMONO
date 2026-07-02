import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';
import { usePOSStore } from '../store/posStore';

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
  pricingProfileId?: string;
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
  const res = await api.get<ProductsResponse>(`/products?${params}`);
  return res.data.data;
}

async function fetchCategories(): Promise<Category[]> {
  const res = await api.get<CategoriesResponse>('/categories');
  return res.data.data;
}

async function fetchProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const res = await api.get<{ success: boolean; data: Product }>(`/products/by-barcode/${encodeURIComponent(barcode)}`);
    return res.data.data;
  } catch {
    return null;
  }
}

export function useProducts(search?: string, categoryId?: string) {
  return useQuery({
    queryKey: ['products', search, categoryId],
    queryFn: () => fetchProducts(search, categoryId),
    staleTime: 15_000,
  });
}

export function useBarcodeLookup() {
  const addItem = usePOSStore((s) => s.addItem);

  const lookupBarcode = useCallback(async (barcode: string) => {
    const product = await fetchProductByBarcode(barcode);
    if (product) {
      addItem({
        productId: product.id,
        name: product.name,
        price: product.basePrice,
        imageUrl: product.imageUrls?.[0],
        categoryId: product.categoryId,
        pricingProfileId: product.pricingProfileId,
      });
      return product;
    }
    return null;
  }, [addItem]);

  return { lookupBarcode };
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 30_000,
  });
}
