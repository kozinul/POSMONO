import { describe, it, expect } from 'vitest';
import { AdjustmentPipeline } from '../AdjustmentPipeline';
import { Adjustment, AdjustmentStep, PipelineContext } from '../Adjustment';

function stub(ctx: PipelineContext, adj: Partial<Adjustment>): Adjustment {
  return {
    id: adj.id ?? 'stub',
    type: adj.type ?? 'CHARGE',
    name: adj.name ?? 'Stub',
    sequence: adj.sequence ?? 10,
    base: adj.base ?? 0,
    rate: adj.rate,
    amount: adj.amount ?? 0,
    affectsTaxBase: adj.affectsTaxBase ?? false,
    affectsGrandTotal: adj.affectsGrandTotal ?? true,
    metadata: adj.metadata,
  };
}

function makeCtx(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    subtotal: 100000,
    runningTotal: 100000,
    taxBase: 100000,
    pricingMode: 'exclusive',
    items: [],
    scopeMatchCtx: {},
    ...overrides,
  };
}

function step(id: string, type: Adjustment['type'], seq: number, exec: (ctx: PipelineContext) => Adjustment): AdjustmentStep {
  return { id, type, name: id, sequence: seq, execute: exec };
}

describe('AdjustmentPipeline', () => {
  const pipeline = new AdjustmentPipeline();

  describe('sequence ordering', () => {
    it('executes steps in ascending sequence order', () => {
      const order: number[] = [];
      const steps: AdjustmentStep[] = [
        step('a', 'TAX', 30, (ctx) => { order.push(30); return stub(ctx, { id: 'a', type: 'TAX', sequence: 30, amount: 0 }); }),
        step('b', 'DISCOUNT', 10, (ctx) => { order.push(10); return stub(ctx, { id: 'b', type: 'DISCOUNT', sequence: 10, amount: 0 }); }),
        step('c', 'CHARGE', 20, (ctx) => { order.push(20); return stub(ctx, { id: 'c', type: 'CHARGE', sequence: 20, amount: 0 }); }),
      ];
      const result = pipeline.execute(steps, makeCtx());
      expect(order).toEqual([10, 20, 30]);
      expect(result[0].sequence).toBe(10);
      expect(result[1].sequence).toBe(20);
      expect(result[2].sequence).toBe(30);
    });

    it('handles equal sequences by preserving insertion order', () => {
      const order: string[] = [];
      const steps: AdjustmentStep[] = [
        step('a', 'CHARGE', 10, (ctx) => { order.push('First'); return stub(ctx, { id: 'a', amount: 0 }); }),
        step('b', 'CHARGE', 10, (ctx) => { order.push('Second'); return stub(ctx, { id: 'b', amount: 0 }); }),
      ];
      pipeline.execute(steps, makeCtx());
      expect(order).toEqual(['First', 'Second']);
    });
  });

  describe('adjustment execution', () => {
    it('discount reduces runningTotal and taxBase', () => {
      const steps: AdjustmentStep[] = [
        step('discount', 'DISCOUNT', 10, (ctx) => {
          ctx.runningTotal -= 10000;
          ctx.taxBase -= 10000;
          return stub(ctx, { id: 'discount', type: 'DISCOUNT', sequence: 10, amount: -10000, base: ctx.subtotal, affectsTaxBase: true });
        }),
      ];
      const ctx = makeCtx({ runningTotal: 100000, taxBase: 100000 });
      pipeline.execute(steps, ctx);
      expect(ctx.runningTotal).toBe(90000);
      expect(ctx.taxBase).toBe(90000);
    });

    it('charge with affectsTaxBase=true increases taxBase', () => {
      const steps: AdjustmentStep[] = [
        step('charge', 'CHARGE', 20, (ctx) => {
          const amt = 9000;
          ctx.runningTotal += amt;
          ctx.taxBase += amt;
          return stub(ctx, { id: 'charge', type: 'CHARGE', sequence: 20, amount: amt, base: 90000, affectsTaxBase: true });
        }),
      ];
      const ctx = makeCtx({ runningTotal: 90000, taxBase: 90000 });
      pipeline.execute(steps, ctx);
      expect(ctx.runningTotal).toBe(99000);
      expect(ctx.taxBase).toBe(99000);
    });

    it('charge with affectsTaxBase=false does not affect taxBase', () => {
      const steps: AdjustmentStep[] = [
        step('delivery', 'CHARGE', 20, (ctx) => {
          ctx.runningTotal += 5000;
          return stub(ctx, { id: 'delivery', type: 'CHARGE', sequence: 20, amount: 5000, base: 90000, affectsTaxBase: false });
        }),
      ];
      const ctx = makeCtx({ runningTotal: 90000, taxBase: 90000 });
      pipeline.execute(steps, ctx);
      expect(ctx.runningTotal).toBe(95000);
      expect(ctx.taxBase).toBe(90000);
    });

    it('tax does not affect taxBase', () => {
      const steps: AdjustmentStep[] = [
        step('tax', 'TAX', 30, (ctx) => {
          ctx.runningTotal += 10890;
          return stub(ctx, { id: 'tax', type: 'TAX', sequence: 30, amount: 10890, base: 99000, rate: 12 });
        }),
      ];
      const ctx = makeCtx({ runningTotal: 99000, taxBase: 99000 });
      pipeline.execute(steps, ctx);
      expect(ctx.runningTotal).toBe(109890);
      expect(ctx.taxBase).toBe(99000);
    });

    it('rounding adjusts final total', () => {
      const steps: AdjustmentStep[] = [
        step('round', 'ROUNDING', 40, (ctx) => {
          const rounded = Math.round(ctx.runningTotal / 100) * 100;
          const amt = rounded - ctx.runningTotal;
          ctx.runningTotal = rounded;
          return stub(ctx, { id: 'round', type: 'ROUNDING', sequence: 40, amount: amt });
        }),
      ];
      const ctx = makeCtx({ runningTotal: 109890 });
      pipeline.execute(steps, ctx);
      expect(ctx.runningTotal).toBe(109900);
    });
  });

  describe('tax setelah charge', () => {
    it('tax sees updated taxBase after charge with affectsTaxBase=true', () => {
      const steps: AdjustmentStep[] = [
        step('charge', 'CHARGE', 20, (ctx) => {
          const amt = Math.round(ctx.taxBase * 0.10);
          ctx.runningTotal += amt;
          ctx.taxBase += amt;
          return stub(ctx, { id: 'charge', type: 'CHARGE', sequence: 20, amount: amt, base: 90000, affectsTaxBase: true });
        }),
        step('tax', 'TAX', 30, (ctx) => {
          const amt = Math.round(ctx.taxBase * 0.12);
          ctx.runningTotal += amt;
          return stub(ctx, { id: 'tax', type: 'TAX', sequence: 30, amount: amt, base: ctx.taxBase, rate: 12 });
        }),
      ];
      const ctx = makeCtx({ runningTotal: 90000, taxBase: 90000 });
      const result = pipeline.execute(steps, ctx);
      expect(result[0].amount).toBe(9000);
      expect(result[1].base).toBe(99000);
      expect(result[1].amount).toBe(11880);
      expect(ctx.runningTotal).toBe(110880);
    });
  });

  describe('rounding terakhir', () => {
    it('rounding step always has highest sequence', () => {
      const result = pipeline.execute([
        step('tax', 'TAX', 30, (ctx) => stub(ctx, { id: 'tax', type: 'TAX', amount: 0 })),
        step('round', 'ROUNDING', 40, (ctx) => stub(ctx, { id: 'round', type: 'ROUNDING', amount: 0 })),
        step('charge', 'CHARGE', 20, (ctx) => stub(ctx, { id: 'charge', type: 'CHARGE', amount: 0 })),
      ], makeCtx());
      expect(result[0].type).toBe('CHARGE');
      expect(result[1].type).toBe('TAX');
      expect(result[2].type).toBe('ROUNDING');
    });
  });

  describe('configurable sequence', () => {
    it('charge with sequence=5 runs before discount with sequence=10', () => {
      const order: string[] = [];
      const steps: AdjustmentStep[] = [
        step('discount', 'DISCOUNT', 10, (ctx) => { order.push('discount'); return stub(ctx, { id: 'discount', type: 'DISCOUNT', amount: 0 }); }),
        step('charge', 'CHARGE', 5, (ctx) => { order.push('charge'); return stub(ctx, { id: 'charge', type: 'CHARGE', amount: 0 }); }),
      ];
      pipeline.execute(steps, makeCtx());
      expect(order).toEqual(['charge', 'discount']);
    });

    it('tax with sequence=25 runs between charge=20 and charge=30', () => {
      const order: string[] = [];
      const steps: AdjustmentStep[] = [
        step('tax', 'TAX', 25, (ctx) => { order.push('tax'); return stub(ctx, { id: 'tax', type: 'TAX', amount: 0 }); }),
        step('charge1', 'CHARGE', 30, (ctx) => { order.push('charge1'); return stub(ctx, { id: 'charge1', type: 'CHARGE', amount: 0 }); }),
        step('charge0', 'CHARGE', 20, (ctx) => { order.push('charge0'); return stub(ctx, { id: 'charge0', type: 'CHARGE', amount: 0 }); }),
      ];
      pipeline.execute(steps, makeCtx());
      expect(order).toEqual(['charge0', 'tax', 'charge1']);
    });
  });

  describe('grand total correctness', () => {
    it('discount + charge + tax + rounding = correct grand total', () => {
      const steps: AdjustmentStep[] = [
        step('discount', 'DISCOUNT', 10, (ctx) => {
          const amt = -10000;
          ctx.runningTotal += amt;
          ctx.taxBase = 90000;
          return stub(ctx, { id: 'discount', type: 'DISCOUNT', sequence: 10, amount: amt, base: 100000, affectsTaxBase: true });
        }),
        step('charge', 'CHARGE', 20, (ctx) => {
          const amt = 9000;
          ctx.runningTotal += amt;
          ctx.taxBase += amt;
          return stub(ctx, { id: 'charge', type: 'CHARGE', sequence: 20, amount: amt, base: 90000, rate: 10, affectsTaxBase: true });
        }),
        step('tax', 'TAX', 30, (ctx) => {
          const amt = Math.round(ctx.taxBase * 11 / 12 * 12 / 100);
          ctx.runningTotal += amt;
          return stub(ctx, { id: 'tax', type: 'TAX', sequence: 30, amount: amt, base: ctx.taxBase, rate: 12, affectsTaxBase: false });
        }),
        step('round', 'ROUNDING', 40, (ctx) => {
          const rounded = Math.round(ctx.runningTotal / 100) * 100;
          const amt = rounded - ctx.runningTotal;
          ctx.runningTotal = rounded;
          return stub(ctx, { id: 'round', type: 'ROUNDING', sequence: 40, amount: amt });
        }),
      ];
      const ctx = makeCtx({ runningTotal: 100000, taxBase: 100000 });
      pipeline.execute(steps, ctx);

      const expectedCharge = 9000;
      const expectedTax = Math.round(99000 * 11 / 12 * 12 / 100);
      const expectedBeforeRound = 100000 - 10000 + expectedCharge + expectedTax;
      const expectedRounded = Math.round(expectedBeforeRound / 100) * 100;

      expect(ctx.runningTotal).toBe(expectedRounded);
    });
  });
});
