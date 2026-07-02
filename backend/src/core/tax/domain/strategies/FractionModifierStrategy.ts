import { ModifierStrategy } from './ModifierStrategy';

export class FractionModifierStrategy implements ModifierStrategy {
  readonly type = 'fraction';

  apply(amount: number, config?: Record<string, number>): number {
    if (!config || !config.numerator || !config.denominator) return amount;
    if (config.denominator === 0) return amount;
    return amount * (config.numerator / config.denominator);
  }
}
