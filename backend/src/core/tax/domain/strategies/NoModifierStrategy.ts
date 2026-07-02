import { ModifierStrategy } from './ModifierStrategy';

export class NoModifierStrategy implements ModifierStrategy {
  readonly type = 'none';

  apply(amount: number): number {
    return amount;
  }
}
