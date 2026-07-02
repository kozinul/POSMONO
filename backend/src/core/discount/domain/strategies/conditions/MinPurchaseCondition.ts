import { ConditionStrategy, IDiscountCondition, ConditionContext } from './ConditionStrategy';

export class MinPurchaseCondition implements ConditionStrategy {
  readonly type = 'min_purchase' as const;

  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean {
    const minAmount = condition.config.minAmount as number;
    return context.subtotal >= minAmount;
  }
}
