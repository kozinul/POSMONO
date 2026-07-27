import { Adjustment, AdjustmentStep, PipelineContext } from './Adjustment';

export class AdjustmentPipeline {
  execute(steps: AdjustmentStep[], ctx: PipelineContext): Adjustment[] {
    const sorted = [...steps].sort((a, b) => a.sequence - b.sequence);
    const adjustments: Adjustment[] = [];

    for (const step of sorted) {
      const adj = step.execute(ctx);
      adjustments.push(adj);
    }

    return adjustments;
  }
}
