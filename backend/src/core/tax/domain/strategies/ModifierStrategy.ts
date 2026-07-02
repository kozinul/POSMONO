export interface IModifierConfig {
  type: 'none' | 'fraction' | 'multiplier' | 'fixed_deduction';
  config?: Record<string, number>;
}

export interface ModifierStrategy {
  readonly type: string;
  apply(amount: number, config?: Record<string, number>): number;
}
