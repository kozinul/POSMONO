export const validPromotionInput = {
  tenantId: 'tenant-test-1',
  name: 'Diskon 10%',
  code: 'DISC10',
  description: 'Diskon 10% untuk semua item',
  priority: 1,
  exclusive: false,
  stackable: false,
  ruleLogic: 'AND' as const,
  rules: [
    { type: 'min_purchase' as const, params: { amount: 50000 } },
  ],
  effects: [
    { type: 'percentage' as const, value: 10, target: 'order' as const },
  ],
  usageLimit: null,
  minPurchase: 50000,
  isActive: true,
  validFrom: null,
  validUntil: null,
  metadata: {},
};

export const validPromotionWithUsageLimit = {
  ...validPromotionInput,
  code: 'LIMITED10',
  usageLimit: 5,
};
