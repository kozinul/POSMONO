import { ITaxScope, TaxScope, ScopeMatchContext } from './TaxScope';

export interface ICharge {
  id: string;
  name: string;
  rate?: number;
  amount?: number;
  includeInTaxBase: boolean;
  scope?: ITaxScope;
  priority: number;
  sequence?: number;
  isActive: boolean;
  effectiveDate?: Date;
  expiresAt?: Date;
}

export interface ChargeCalculationResult {
  name: string;
  amount: number;
  includeInTaxBase: boolean;
}

export class Charge {
  private constructor(private readonly data: ICharge) {}

  static create(data: ICharge): Charge {
    return new Charge(data);
  }

  static new(
    name: string,
    rate: number,
    priority: number,
    includeInTaxBase: boolean,
    overrides?: Partial<ICharge>,
  ): Charge {
    return new Charge({
      id: overrides?.id || `charge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      rate,
      includeInTaxBase,
      scope: overrides?.scope,
      priority,
      sequence: overrides?.sequence,
      isActive: overrides?.isActive ?? true,
      effectiveDate: overrides?.effectiveDate,
      expiresAt: overrides?.expiresAt,
    });
  }

  static flat(
    name: string,
    amount: number,
    priority: number,
    includeInTaxBase: boolean,
    overrides?: Partial<ICharge>,
  ): Charge {
    return new Charge({
      id: overrides?.id || `charge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      amount,
      includeInTaxBase,
      scope: overrides?.scope,
      priority,
      sequence: overrides?.sequence,
      isActive: overrides?.isActive ?? true,
      effectiveDate: overrides?.effectiveDate,
      expiresAt: overrides?.expiresAt,
    });
  }

  getId(): string { return this.data.id; }
  getName(): string { return this.data.name; }
  getPriority(): number { return this.data.priority; }
  getSequence(): number { return this.data.sequence ?? 20; }
  getRate(): number | undefined { return this.data.rate; }
  isIncludedInTaxBase(): boolean { return this.data.includeInTaxBase; }

  getScope(): TaxScope | undefined {
    return this.data.scope ? TaxScope.create(this.data.scope) : undefined;
  }

  isEnabled(): boolean {
    if (!this.data.isActive) return false;
    if (this.data.effectiveDate) {
      const now = new Date();
      if (now < this.data.effectiveDate) return false;
    }
    if (this.data.expiresAt) {
      const now = new Date();
      if (now > this.data.expiresAt) return false;
    }
    return true;
  }

  shouldApply(context: ScopeMatchContext): boolean {
    if (!this.isEnabled()) return false;
    const scope = this.getScope();
    if (scope) return scope.appliesTo(context);
    return true;
  }

  calculate(base: number): number {
    if (this.data.rate !== undefined) {
      return Math.round(base * (this.data.rate / 100));
    }
    if (this.data.amount !== undefined) {
      return Math.round(this.data.amount);
    }
    return 0;
  }

  calculateInclusive(price: number): number {
    if (this.data.rate !== undefined) {
      const divisor = 1 + this.data.rate / 100;
      return Math.round(price - price / divisor);
    }
    if (this.data.amount !== undefined) {
      return Math.min(Math.round(this.data.amount), price);
    }
    return 0;
  }

  serialize(): ICharge {
    return {
      ...this.data,
      scope: this.data.scope ? { ...this.data.scope } : undefined,
    };
  }
}
