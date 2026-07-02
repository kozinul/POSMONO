import { describe, it, expect } from 'vitest';
import { ModifierEngine } from '../ModifierEngine';

describe('ModifierEngine', () => {
  const engine = new ModifierEngine();

  describe('no modifier', () => {
    it('returns original amount when modifier is undefined', () => {
      expect(engine.apply(100000)).toBe(100000);
    });

    it('returns original amount when modifier type is none', () => {
      expect(engine.apply(100000, { type: 'none' })).toBe(100000);
    });
  });

  describe('fraction modifier', () => {
    it('applies numerator/denominator formula', () => {
      const result = engine.apply(120000, {
        type: 'fraction',
        config: { numerator: 11, denominator: 12 },
      });
      expect(result).toBe(110000);
    });

    it('returns base amount when config missing', () => {
      const result = engine.apply(100000, { type: 'fraction' });
      expect(result).toBe(100000);
    });

    it('returns base amount when denominator is 0', () => {
      const result = engine.apply(100000, {
        type: 'fraction',
        config: { numerator: 1, denominator: 0 },
      });
      expect(result).toBe(100000);
    });

    it('handles custom fractions', () => {
      const result = engine.apply(100000, {
        type: 'fraction',
        config: { numerator: 1, denominator: 2 },
      });
      expect(result).toBe(50000);
    });
  });

  describe('multiplier modifier', () => {
    it('applies multiplier', () => {
      const result = engine.apply(100000, {
        type: 'multiplier',
        config: { multiplier: 0.8 },
      });
      expect(result).toBe(80000);
    });

    it('returns base amount when config missing', () => {
      const result = engine.apply(100000, { type: 'multiplier' });
      expect(result).toBe(100000);
    });
  });

  describe('fixed_deduction modifier', () => {
    it('subtracts deduction from amount', () => {
      const result = engine.apply(100000, {
        type: 'fixed_deduction',
        config: { deduction: 5000 },
      });
      expect(result).toBe(95000);
    });

    it('returns 0 when deduction exceeds amount', () => {
      const result = engine.apply(5000, {
        type: 'fixed_deduction',
        config: { deduction: 10000 },
      });
      expect(result).toBe(0);
    });

    it('returns base amount when config missing', () => {
      const result = engine.apply(100000, { type: 'fixed_deduction' });
      expect(result).toBe(100000);
    });
  });
});
