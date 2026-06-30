export const MODULES = {
  RESTAURANT: 'restaurant',
  HOSPITALITY: 'hospitality',
  RETAIL: 'retail',
} as const;

export const MODULE_DISPLAY_NAMES = {
  [MODULES.RESTAURANT]: 'Restaurant Module',
  [MODULES.HOSPITALITY]: 'Hospitality Module',
  [MODULES.RETAIL]: 'Retail Module',
} as const;

export type ModuleId = (typeof MODULES)[keyof typeof MODULES];
