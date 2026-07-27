import { Adjustment, AdjustmentStep, PipelineContext } from '../Adjustment';
import { RoundingEngine, RoundingMode } from '../RoundingEngine';

const roundingEngine = new RoundingEngine();

export class RoundingStep implements AdjustmentStep {
  readonly type = 'ROUNDING' as const;
  readonly id = 'rounding';
  readonly name: string;
  readonly sequence: number;
  private readonly mode: RoundingMode;
  private readonly precision: number;

  constructor(sequence = 40, mode: RoundingMode = 'round', precision = 0) {
    this.name = precision > 0 ? `Pembulatan (${precision})` : 'Pembulatan';
    this.sequence = sequence;
    this.mode = mode;
    this.precision = precision;
  }

  execute(ctx: PipelineContext): Adjustment {
    const before = ctx.runningTotal;
    const rounded = roundingEngine.round(before, this.mode, this.precision);
    const amount = rounded - before;
    ctx.runningTotal = rounded;

    return {
      id: this.id,
      type: 'ROUNDING',
      name: this.name,
      sequence: this.sequence,
      base: before,
      amount,
      affectsTaxBase: false,
      affectsGrandTotal: true,
    };
  }
}
