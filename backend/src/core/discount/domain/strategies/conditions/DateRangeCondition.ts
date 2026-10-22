import { ConditionStrategy, IDiscountCondition, ConditionContext } from './ConditionStrategy';

export class DateRangeCondition implements ConditionStrategy {
  readonly type = 'date_range' as const;

  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean {
    const rawStart = condition.config.startDate as string | undefined;
    const rawEnd = condition.config.endDate as string | undefined;

    // A date range without any bound is "no restriction", not "never matches".
    if (!rawStart && !rawEnd) return true;

    const date = context.currentDate ?? new Date();

    if (rawStart) {
      const startDate = new Date(rawStart);
      if (isNaN(startDate.getTime())) return false;
      if (date < startDate) return false;
    }

    if (rawEnd) {
      const endDate = new Date(rawEnd);
      if (isNaN(endDate.getTime())) return false;
      if (date > endDate) return false;
    }

    return true;
  }
}
