export const BUSINESS_TYPES = {
  RETAIL: 'retail',
  RESTAURANT: 'restaurant',
  HOSPITALITY: 'hospitality',
  MIXED: 'mixed',
} as const;

export type BusinessType = (typeof BUSINESS_TYPES)[keyof typeof BUSINESS_TYPES];
