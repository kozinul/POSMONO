export type TaxPolicyType = 'rate' | 'amount' | 'percentage_of_base' | 'formula';
export type RoundingMode = 'round' | 'floor' | 'ceil';

export interface ITaxPolicy {
  type: TaxPolicyType;
  value: number;
  roundingMode: RoundingMode;
  precision: number;
}

export class TaxPolicy {
  private constructor(private readonly data: ITaxPolicy) {}

  static create(data: ITaxPolicy): TaxPolicy {
    return new TaxPolicy(data);
  }

  getValue(): number {
    return this.data.value;
  }

  getType(): TaxPolicyType {
    return this.data.type;
  }

  getRoundingMode(): RoundingMode {
    return this.data.roundingMode;
  }

  getPrecision(): number {
    return this.data.precision;
  }

  serialize(): ITaxPolicy {
    return { ...this.data };
  }
}
