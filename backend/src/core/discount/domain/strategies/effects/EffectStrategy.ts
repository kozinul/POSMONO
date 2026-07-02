export type EffectType =
  | 'percentage_off'
  | 'nominal_off'
  | 'free_item'
  | 'fixed_price'
  | 'bundle_price';

export interface IDiscountEffect {
  type: EffectType;
  config: Record<string, unknown>;
}

export interface EffectContext {
  subtotal: number;
  items: Array<{ productId: string; categoryId: string; quantity: number; unitPrice: number; lineTotal: number }>;
  appliedDiscounts: number;
}

export interface EffectResult {
  discountAmount: number;
  description: string;
  freeItems?: Array<{ productId: string; quantity: number }>;
}

export interface EffectStrategy {
  readonly type: EffectType;
  apply(effect: IDiscountEffect, context: EffectContext): EffectResult;
}
