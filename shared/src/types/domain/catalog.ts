export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  pricingMode?: 'inclusive' | 'exclusive';
  pricingProfileId?: string;
  imageUrls: string[];
  tags: string[];
  modifierGroupIds: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Family {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
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

export type ModifierDisplayType = 'radio' | 'checkbox' | 'stepper';

export interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  isActive: boolean;
}

export interface Modifier {
  id: string;
  tenantId: string;
  productId: string | null;
  familyId: string | null;
  name: string;
  displayType: ModifierDisplayType;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
  required: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ModifierGroup = Modifier;
