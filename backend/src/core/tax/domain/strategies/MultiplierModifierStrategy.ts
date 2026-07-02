import { ModifierStrategy } from './ModifierStrategy';

export class MultiplierModifierStrategy implements ModifierStrategy {
  readonly type = 'multiplier';

  apply(amount: number, config?: Record<string, number>): number {
    if (!config || config.multiplier === undefined) return amount;
    return amount * config.multiplier;
  }
}
