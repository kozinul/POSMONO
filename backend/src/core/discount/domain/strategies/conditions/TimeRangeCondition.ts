import { ConditionStrategy, IDiscountCondition, ConditionContext } from './ConditionStrategy';

export class TimeRangeCondition implements ConditionStrategy {
  readonly type = 'time_range' as const;

  evaluate(condition: IDiscountCondition, context: ConditionContext): boolean {
    const now = context.currentDate ?? new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const fromHour = (condition.config.fromHour as number) ?? 0;
    const fromMinute = (condition.config.fromMinute as number) ?? 0;
    const toHour = (condition.config.toHour as number) ?? 23;
    const toMinute = (condition.config.toMinute as number) ?? 59;

    const fromMinutes = fromHour * 60 + fromMinute;
    const toMinutes = toHour * 60 + toMinute;

    return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
  }
}
