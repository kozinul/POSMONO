import { ConditionStrategy, IDiscountCondition, ConditionContext } from './ConditionStrategy';

export class ProductMatchCondition implements ConditionStrategy {
  readonly type = 'product_match' as const;

  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean {
    const productIds = condition.config.productIds as string[];
    return context.items.some((item) => productIds.includes(item.productId));
  }
}
