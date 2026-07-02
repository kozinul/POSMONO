import { describe, it, expect } from 'vitest';
import { DiscountPolicy } from '../DiscountPolicy';

describe('DiscountPolicy', () => {
  it('creates percentage policy', () => {
    const policy = DiscountPolicy.percentage(10, { maxCap: 50000 });
    expect(policy.getType()).toBe('percentage');
    expect(policy.getValue()).toBe(10);
    expect(policy.getMaxCap()).toBe(50000);
  });

  it('creates nominal policy', () => {
    const policy = DiscountPolicy.nominal(25000);
    expect(policy.getType()).toBe('nominal');
    expect(policy.getValue()).toBe(25000);
  });

  it('serializes correctly', () => {
    const policy = DiscountPolicy.percentage(15, { maxCap: 100000, roundingMode: 'floor', application: 'per_category' });
    expect(policy.serialize()).toEqual({
      type: 'percentage',
      value: 15,
      maxCap: 100000,
      application: 'per_category',
      roundingMode: 'floor',
      precision: 2,
    });
  });
});
