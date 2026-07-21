import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  barcode: string;
  bc: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  pricingProfileId?: string;
  imageUrls: string[];
  tags: string[];
  country: string;
  region: string;
  currency: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  familyId: string | null;
  sortOrder: number;
}

export interface Family {
  id: string;
  name: string;
  menuType: 'food' | 'beverage';
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

interface FamiliesResponse {
  success: boolean;
  data: Family[];
}

export interface ProductListOptions {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
}

async function fetchProducts(options: ProductListOptions = {}): Promise<{ products: Product[]; total: number }> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.search) params.set('search', options.search);
  if (options.categoryId) params.set('categoryId', options.categoryId);
  const res = await api.get<ProductsResponse>(`/products?${params}`);
  return { products: res.data.data, total: res.data.meta.total };
}

async function fetchCategories(): Promise<Category[]> {
  const res = await api.get<CategoriesResponse>('/categories');
  return res.data.data;
}

async function fetchFamilies(menuType?: string): Promise<Family[]> {
  const url = menuType ? `/families/by-menu-type/${menuType}` : '/families';
  const res = await api.get<FamiliesResponse>(url);
  return res.data.data;
}

async function createProduct(data: Partial<Product>): Promise<Product> {
  const res = await api.post<{ success: boolean; data: Product }>('/products', data);
  return res.data.data;
}

async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const res = await api.put<{ success: boolean; data: Product }>(`/products/${id}`, data);
  return res.data.data;
}

async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`);
}

async function uploadFile(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<{ success: boolean; data: { url: string } }>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export function useProductList(options: ProductListOptions) {
  return useQuery({
    queryKey: ['products', options],
    queryFn: () => fetchProducts(options),
    staleTime: 10_000,
  });
}

export function useCategoryList() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 30_000,
  });
}

export function useFamilyList(menuType?: string) {
  return useQuery({
    queryKey: ['families', menuType],
    queryFn: () => fetchFamilies(menuType),
    staleTime: 30_000,
  });
}

export function useUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
