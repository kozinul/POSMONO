import { IModifierConfig, ModifierStrategy } from './strategies/ModifierStrategy';
import { NoModifierStrategy } from './strategies/NoModifierStrategy';
import { FractionModifierStrategy } from './strategies/FractionModifierStrategy';
import { MultiplierModifierStrategy } from './strategies/MultiplierModifierStrategy';
import { FixedDeductionStrategy } from './strategies/FixedDeductionStrategy';

export { IModifierConfig };

export class ModifierEngine {
  private strategies: Map<string, ModifierStrategy> = new Map();

  constructor() {
    this.register(new NoModifierStrategy());
    this.register(new FractionModifierStrategy());
    this.register(new MultiplierModifierStrategy());
    this.register(new FixedDeductionStrategy());
  }

  register(strategy: ModifierStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  apply(amount: number, modifier?: IModifierConfig): number {
    if (!modifier || modifier.type === 'none') return amount;
    const strategy = this.strategies.get(modifier.type);
    if (!strategy) return amount;
    return strategy.apply(amount, modifier.config);
  }
}
