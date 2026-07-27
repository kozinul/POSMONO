import { TaxItem, ScopeMatchContext } from './PricingEngine';

export type AdjustmentType = 'DISCOUNT' | 'CHARGE' | 'TAX' | 'ROUNDING';

export interface Adjustment {
  id: string;
  type: AdjustmentType;
  name: string;
  sequence: number;
  base: number;
  rate?: number;
  amount: number;
  affectsTaxBase: boolean;
  affectsGrandTotal: boolean;
  metadata?: Record<string, unknown>;
}

export interface AdjustmentStep {
  readonly id: string;
  readonly type: AdjustmentType;
  readonly name: string;
  readonly sequence: number;
  execute(ctx: PipelineContext): Adjustment;
}

export interface PipelineContext {
  subtotal: number;
  runningTotal: number;
  taxBase: number;
  pricingMode: 'inclusive' | 'exclusive';
  items: TaxItem[];
  scopeMatchCtx: ScopeMatchContext;
}
