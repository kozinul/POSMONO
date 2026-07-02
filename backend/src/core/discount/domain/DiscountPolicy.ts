export type DiscountType = 'percentage' | 'nominal' | 'free_item' | 'fixed_price' | 'bundle_price';
export type DiscountApplication = 'per_item' | 'per_category' | 'per_order' | 'cheapest_free';
export type RoundingMode = 'round' | 'floor' | 'ceil';

export interface IDiscountPolicy {
  type: DiscountType;
  value: number;
  maxCap?: number;
  application: DiscountApplication;
  roundingMode: RoundingMode;
  precision: number;
}

export class DiscountPolicy {
  private constructor(private readonly data: IDiscountPolicy) {}

  static create(data: IDiscountPolicy): DiscountPolicy {
    return new DiscountPolicy(data);
  }

  static percentage(value: number, overrides?: Partial<IDiscountPolicy>): DiscountPolicy {
    return new DiscountPolicy({
      type: 'percentage',
      value,
      application: 'per_order',
      roundingMode: 'round',
      precision: 2,
      ...overrides,
    });
  }

  static nominal(value: number, overrides?: Partial<IDiscountPolicy>): DiscountPolicy {
    return new DiscountPolicy({
      type: 'nominal',
      value,
      application: 'per_order',
      roundingMode: 'round',
      precision: 2,
      ...overrides,
    });
  }

  getType(): DiscountType { return this.data.type; }
  getValue(): number { return this.data.value; }
  getMaxCap(): number | undefined { return this.data.maxCap; }
  getApplication(): DiscountApplication { return this.data.application; }
  getRoundingMode(): RoundingMode { return this.data.roundingMode; }
  getPrecision(): number { return this.data.precision; }

  serialize(): IDiscountPolicy {
    return { ...this.data };
  }
}
