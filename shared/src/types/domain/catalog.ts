export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  imageUrls: string[];
  tags: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  price: number;
  sku: string;
  isActive: boolean;
}

export interface Modifier {
  id: string;
  productId: string;
  name: string;
  type: 'select' | 'multi';
  options: ModifierOption[];
  min: number;
  max: number;
  isRequired: boolean;
}

export interface ModifierOption {
  name: string;
  price: number;
}
