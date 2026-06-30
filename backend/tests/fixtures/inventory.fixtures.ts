export const validStockInput = {
  tenantId: 'tenant-test-1',
  productId: 'product-1',
  variantId: null,
  warehouseId: 'wh-1',
  quantity: 50,
  reservedQuantity: 0,
  minLevel: 5,
  maxLevel: 100,
};

export const validStockMovementInput = {
  tenantId: 'tenant-test-1',
  productId: 'product-1',
  variantId: null,
  warehouseId: 'wh-1',
  type: 'in' as const,
  quantity: 10,
  beforeQuantity: 40,
  afterQuantity: 50,
  referenceType: 'purchase_order',
  referenceId: 'po-001',
  notes: 'Restock dari supplier',
  userId: 'user-1',
};
