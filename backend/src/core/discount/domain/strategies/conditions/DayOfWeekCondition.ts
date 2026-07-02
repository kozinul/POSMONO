import { ConditionStrategy, IDiscountCondition, ConditionContext } from './ConditionStrategy';

export class DayOfWeekCondition implements ConditionStrategy {
  readonly type = 'day_of_week' as const;

  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean {
    const days = condition.config.days as number[];
    const date = context.currentDate ?? new Date();
    return days.includes(date.getDay());
  }
}
