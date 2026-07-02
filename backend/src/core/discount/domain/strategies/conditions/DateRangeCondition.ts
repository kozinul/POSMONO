import { ConditionStrategy, IDiscountCondition, ConditionContext } from './ConditionStrategy';

export class DateRangeCondition implements ConditionStrategy {
  readonly type = 'date_range' as const;

  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean {
    const startDate = new Date(condition.config.startDate as string);
    const endDate = new Date(condition.config.endDate as string);
    const date = context.currentDate ?? new Date();
    return date >= startDate && date <= endDate;
  }
}
