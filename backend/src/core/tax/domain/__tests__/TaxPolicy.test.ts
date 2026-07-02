import { describe, it, expect } from 'vitest';
import { TaxPolicy } from '../TaxPolicy';

describe('TaxPolicy', () => {
  describe('create', () => {
    it('creates policy with given data', () => {
      const policy = TaxPolicy.create({
        type: 'rate', value: 10, roundingMode: 'round', precision: 2,
      });
      expect(policy.getType()).toBe('rate');
      expect(policy.getValue()).toBe(10);
      expect(policy.getRoundingMode()).toBe('round');
      expect(policy.getPrecision()).toBe(2);
    });

    it('creates amount type policy', () => {
      const policy = TaxPolicy.create({
        type: 'amount', value: 5000, roundingMode: 'round', precision: 0,
      });
      expect(policy.getType()).toBe('amount');
      expect(policy.getValue()).toBe(5000);
    });
  });

  describe('serialize', () => {
    it('returns copy of data', () => {
      const policy = TaxPolicy.create({
        type: 'rate', value: 11, roundingMode: 'round', precision: 2,
      });
      const s = policy.serialize();
      expect(s.type).toBe('rate');
      expect(s.value).toBe(11);
      expect(s.roundingMode).toBe('round');
    });
  });
});
