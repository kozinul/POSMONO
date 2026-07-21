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
  discountTotal: 0,
  dppTotal: 50000,
  tax: 0,
  taxDetails: [],
  total: 50000,
  roundingAdjustment: 0,
  roundedPayable: 50000,
  roundingMethod: 'nearest',
  serviceCharge: 0,
  serviceChargeRate: 0,
  customerId: null,
  customerName: null,
  cashierId: 'cashier-1',
  cashierName: 'Kasir 1',
  tableNumber: null,
  transactionType: 'dine_in' as const,
  notes: '',
  source: 'pos' as const,
  metadata: {},
};

export const validPaymentBreakdown = [
  { method: 'cash', code: 'CASH', amount: 50000, change: 0 },
];
