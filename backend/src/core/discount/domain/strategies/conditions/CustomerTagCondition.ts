import { ConditionStrategy, IDiscountCondition, ConditionContext } from './ConditionStrategy';

export class CustomerTagCondition implements ConditionStrategy {
  readonly type = 'customer_tag' as const;

  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean {
    const requiredTags = (condition.config.tags as string[]) ?? [];
    const customerTags = context.customerTags ?? [];
    return requiredTags.some((tag) => customerTags.includes(tag));
  }
}
