export type ConditionType =
  | 'min_purchase'
  | 'min_items'
  | 'category_match'
  | 'product_match'
  | 'day_of_week'
  | 'date_range'
  | 'quantity_threshold';

export interface IDiscountCondition {
  type: ConditionType;
  config: Record<string, unknown>;
}

export interface ConditionContext {
  subtotal: number;
  items: Array<{ productId: string; categoryId: string; quantity: number; unitPrice: number }>;
  currentDate?: Date;
  customerGroupId?: string;
  promoCode?: string;
}

export interface ConditionStrategy {
  readonly type: ConditionType;
  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean;
}
