export interface Stock {
  id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minLevel: number;
  maxLevel: number;
  costPrice: number;
  updatedAt: Date;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'reserve' | 'release' | 'void';

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  type: StockMovementType;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  unitCost: number;
  referenceType: string;
  referenceId: string;
  notes: string;
  userId: string;
  createdAt: Date;
}
