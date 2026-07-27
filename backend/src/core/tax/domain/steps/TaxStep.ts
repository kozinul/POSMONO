import { Adjustment, AdjustmentStep, PipelineContext } from '../Adjustment';
import { TaxRule } from '../TaxRule';
import { ModifierEngine } from '../ModifierEngine';

const modifierEngine = new ModifierEngine();

export class TaxStep implements AdjustmentStep {
  readonly type = 'TAX' as const;
  readonly id: string;
  readonly name: string;
  readonly sequence: number;
  private readonly rule: TaxRule;

  constructor(rule: TaxRule) {
    this.id = rule.getId();
    this.name = rule.getName();
    this.sequence = rule.getSequence();
    this.rule = rule;
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
    const modifierCfg = this.rule.getModifier();
    const modifierBefore = modifierEngine.apply(base, modifierCfg);
    const amount = this.rule.calculateTax(base, false);

    ctx.runningTotal += amount;

    const metadata: Record<string, unknown> = {};
    if (modifierCfg && modifierCfg.type !== 'none') {
      metadata.modifier = modifierCfg.type === 'fraction'
        ? `${modifierCfg.config?.numerator}/${modifierCfg.config?.denominator}`
        : modifierCfg.type;
      metadata.modifierBefore = base;
      metadata.modifierAfter = modifierBefore;
    }

    return {
      id: this.id,
      type: 'TAX',
      name: this.name,
      sequence: this.sequence,
      base,
      rate: this.rule.getPolicy().getValue(),
      amount,
      affectsTaxBase: false,
      affectsGrandTotal: true,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  private executeInclusive(ctx: PipelineContext): Adjustment {
    const base = ctx.runningTotal;
    const amount = this.rule.calculateTax(base, true);

    ctx.runningTotal -= amount;
    ctx.taxBase = ctx.runningTotal;

    const metadata: Record<string, unknown> = {};
    const modifierCfg = this.rule.getModifier();
    if (modifierCfg && modifierCfg.type !== 'none') {
      metadata.modifier = modifierCfg.type === 'fraction'
        ? `${modifierCfg.config?.numerator}/${modifierCfg.config?.denominator}`
        : modifierCfg.type;
    }

    return {
      id: this.id,
      type: 'TAX',
      name: this.name,
      sequence: this.sequence,
      base,
      rate: this.rule.getPolicy().getValue(),
      amount,
      affectsTaxBase: false,
      affectsGrandTotal: true,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }
}
