export const validPaymentInput = {
  tenantId: 'tenant-test-1',
  orderId: 'order-test-1',
  amount: 50000,
  status: 'pending' as const,
  method: 'cash' as const,
  referenceNumber: 'CASH-TEST-001',
  metadata: { cashierId: 'cashier-1' },
  paidAt: null,
};
