import { ConditionStrategy, IDiscountCondition, ConditionContext } from './strategies/conditions/ConditionStrategy';
import { MinPurchaseCondition } from './strategies/conditions/MinPurchaseCondition';
import { MinItemsCondition } from './strategies/conditions/MinItemsCondition';
import { CategoryMatchCondition } from './strategies/conditions/CategoryMatchCondition';
import { ProductMatchCondition } from './strategies/conditions/ProductMatchCondition';
import { DayOfWeekCondition } from './strategies/conditions/DayOfWeekCondition';
import { DateRangeCondition } from './strategies/conditions/DateRangeCondition';
import { QuantityThresholdCondition } from './strategies/conditions/QuantityThresholdCondition';

export class ConditionEvaluator {
  private strategies: Map<string, ConditionStrategy> = new Map();

  constructor() {
    this.register(new MinPurchaseCondition());
    this.register(new MinItemsCondition());
    this.register(new CategoryMatchCondition());
    this.register(new ProductMatchCondition());
    this.register(new DayOfWeekCondition());
    this.register(new DateRangeCondition());
    this.register(new QuantityThresholdCondition());
  }

  register(strategy: ConditionStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  evaluate(conditions: IDiscountCondition[], context: ConditionContext): boolean {
    if (conditions.length === 0) return true;
    return conditions.every((condition) => {
      const strategy = this.strategies.get(condition.type);
      if (!strategy) return false;
      return strategy.evaluate(condition, context);
    });
  }
}
