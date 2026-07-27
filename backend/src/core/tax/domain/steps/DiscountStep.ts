import { Adjustment, AdjustmentStep, PipelineContext } from '../Adjustment';

export class DiscountStep implements AdjustmentStep {
  readonly type = 'DISCOUNT' as const;
  readonly id: string;
  readonly name: string;
  readonly sequence: number;
  private readonly discount: number;
  private readonly discountType?: 'percentage' | 'nominal';

  constructor(
    discount: number,
    discountType?: 'percentage' | 'nominal',
    sequence = 10,
  ) {
    this.id = `discount_${Date.now()}`;
    this.name = 'Diskon';
    this.sequence = sequence;
    this.discount = discount;
    this.discountType = discountType;
  }

  execute(ctx: PipelineContext): Adjustment {
    const amount = this.calcDiscount(ctx.subtotal, this.discount, this.discountType);
    ctx.runningTotal -= amount;
    ctx.taxBase = ctx.subtotal - amount;

    return {
      id: this.id,
      type: 'DISCOUNT',
      name: this.name,
      sequence: this.sequence,
      base: ctx.subtotal,
      rate: this.discountType === 'percentage' ? this.discount : undefined,
      amount: -amount,
      affectsTaxBase: true,
      affectsGrandTotal: true,
    };
  }

  private calcDiscount(subtotal: number, discount: number, type?: 'percentage' | 'nominal'): number {
    if (discount <= 0) return 0;
    if (type === 'percentage') {
      return subtotal * (Math.min(discount, 100) / 100);
    }
    return Math.min(discount, subtotal);
  }
}
