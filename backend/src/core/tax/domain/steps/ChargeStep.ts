import { Adjustment, AdjustmentStep, PipelineContext } from '../Adjustment';
import { Charge } from '../Charge';

export class ChargeStep implements AdjustmentStep {
  readonly type = 'CHARGE' as const;
  readonly id: string;
  readonly name: string;
  readonly sequence: number;
  private readonly charge: Charge;

  constructor(charge: Charge) {
    this.id = charge.getId();
    this.name = charge.getName();
    this.sequence = charge.getSequence();
    this.charge = charge;
  }

  execute(ctx: PipelineContext): Adjustment {
    const isInclusive = ctx.pricingMode === 'inclusive';

    if (isInclusive) {
      return this.executeInclusive(ctx);
    }
    return this.executeExclusive(ctx);
  }

  private executeExclusive(ctx: PipelineContext): Adjustment {
    const base = ctx.taxBase;
    const amount = this.charge.calculate(base);

    ctx.runningTotal += amount;
    if (this.charge.isIncludedInTaxBase()) {
      ctx.taxBase += amount;
    }

    return {
      id: this.id,
      type: 'CHARGE',
      name: this.name,
      sequence: this.sequence,
      base,
      rate: this.charge.getRate(),
      amount,
      affectsTaxBase: this.charge.isIncludedInTaxBase(),
      affectsGrandTotal: true,
    };
  }

  private executeInclusive(ctx: PipelineContext): Adjustment {
    const remaining = ctx.runningTotal;
    const amount = this.charge.calculateInclusive(remaining);

    ctx.runningTotal -= amount;
    if (this.charge.isIncludedInTaxBase()) {
      ctx.taxBase = ctx.runningTotal;
    }

    return {
      id: this.id,
      type: 'CHARGE',
      name: this.name,
      sequence: this.sequence,
      base: remaining,
      rate: this.charge.getRate(),
      amount,
      affectsTaxBase: this.charge.isIncludedInTaxBase(),
      affectsGrandTotal: true,
    };
  }
}
