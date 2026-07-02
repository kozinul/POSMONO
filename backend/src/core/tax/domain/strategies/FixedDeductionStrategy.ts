import { ModifierStrategy } from './ModifierStrategy';

export class FixedDeductionStrategy implements ModifierStrategy {
  readonly type = 'fixed_deduction';

  apply(amount: number, config?: Record<string, number>): number {
    if (!config || config.deduction === undefined) return amount;
    return Math.max(0, amount - config.deduction);
  }
}
