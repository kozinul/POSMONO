import { ConditionStrategy, IDiscountCondition, ConditionContext } from './ConditionStrategy';

export class QuantityThresholdCondition implements ConditionStrategy {
  readonly type = 'quantity_threshold' as const;

  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean {
    const productId = condition.config.productId as string;
    const minQty = condition.config.minQuantity as number;
    const item = context.items.find((i) => i.productId === productId);
    return !!item && item.quantity >= minQty;
  }
}
