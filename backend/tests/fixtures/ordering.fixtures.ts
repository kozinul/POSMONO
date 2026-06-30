export const validOrderItem = {
  productId: 'product-1',
  variantId: null,
  productName: 'Nasi Goreng',
  quantity: 2,
  unitPrice: 25000,
  totalPrice: 50000,
  modifiers: [],
  tax: { rate: 0, amount: 0 },
};

export const validOrderInput = {
  tenantId: 'tenant-test-1',
  items: [validOrderItem],
  subtotal: 50000,
  discount: 0,
  tax: 0,
  total: 50000,
  customerId: null,
  cashierId: 'cashier-1',
  notes: '',
  source: 'pos' as const,
  metadata: {},
};
