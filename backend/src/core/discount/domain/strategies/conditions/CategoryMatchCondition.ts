import { ConditionStrategy, IDiscountCondition, ConditionContext } from './ConditionStrategy';

export class CategoryMatchCondition implements ConditionStrategy {
  readonly type = 'category_match' as const;

  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean {
    const categoryIds = condition.config.categoryIds as string[];
    return context.items.some((item) => categoryIds.includes(item.categoryId));
  }
}
