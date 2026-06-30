export interface Stock {
  id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  minLevel: number;
  maxLevel: number;
  updatedAt: Date;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  isActive: boolean;
  createdAt: Date;
}

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'reserve' | 'release';

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  type: StockMovementType;
  quantity: number;
  referenceType: string;
  referenceId: string;
  notes: string;
  userId: string;
  createdAt: Date;
}
