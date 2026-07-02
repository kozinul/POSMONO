import { ConditionStrategy, IDiscountCondition, ConditionContext } from './ConditionStrategy';

export class MinItemsCondition implements ConditionStrategy {
  readonly type = 'min_items' as const;

  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean {
    const minItems = condition.config.minItems as number;
    const totalItems = context.items.reduce((sum, i) => sum + i.quantity, 0);
    return totalItems >= minItems;
  }
}
