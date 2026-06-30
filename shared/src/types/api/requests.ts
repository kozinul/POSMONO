export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface RegisterTenantRequest {
  tenantName: string;
  email: string;
  password: string;
  businessType: string;
}

export interface CreateProductRequest {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  tags?: string[];
}
