import { describe, it, expect } from 'vitest';
import { DiscountRule } from '../DiscountRule';
import { DiscountScope } from '../DiscountScope';
import { DiscountPolicy } from '../DiscountPolicy';

describe('DiscountRule', () => {
  it('creates a percentage discount rule', () => {
    const rule = DiscountRule.new(
      'Diskon 10%',
      10,
      DiscountScope.all(),
      DiscountPolicy.percentage(10, { maxCap: 50000 }),
    );
    expect(rule.getName()).toBe('Diskon 10%');
    expect(rule.getPriority()).toBe(10);
    expect(rule.isStackable()).toBe(true);
    expect(rule.isActive()).toBe(true);
  });

  it('calculates percentage discount with cap', () => {
    const rule = DiscountRule.new(
      'Diskon 10%',
      10,
      DiscountScope.all(),
      DiscountPolicy.percentage(10, { maxCap: 500 }),
    );
    const result = rule.calculate(10000);
    expect(result.discountAmount).toBe(500);
    expect(result.description).toContain('max');
  });

  it('calculates percentage discount without exceeding cap', () => {
    const rule = DiscountRule.new(
      'Diskon 10%',
      10,
      DiscountScope.all(),
      DiscountPolicy.percentage(10, { maxCap: 5000 }),
    );
    const result = rule.calculate(10000);
    expect(result.discountAmount).toBe(1000);
  });

  it('calculates nominal discount capped at subtotal', () => {
    const rule = DiscountRule.new(
      'Diskon 25rb',
      10,
      DiscountScope.all(),
      DiscountPolicy.nominal(25000),
    );
    expect(rule.calculate(10000).discountAmount).toBe(10000);
    expect(rule.calculate(50000).discountAmount).toBe(25000);
  });

  it('detects expiration from end date', () => {
    const rule = DiscountRule.new(
      'Expired',
      10,
      DiscountScope.all(),
      DiscountPolicy.percentage(10),
      { endDate: '2020-01-01' },
    );
    expect(rule.isExpired()).toBe(true);
  });

  it('detects expiration from usage count', () => {
    const rule = DiscountRule.new(
      'Limited',
      10,
      DiscountScope.all(),
      DiscountPolicy.percentage(10),
      { maxUsageCount: 5, currentUsageCount: 5 },
    );
    expect(rule.isExpired()).toBe(true);
  });

  it('serializes correctly', () => {
    const rule = DiscountRule.new(
      'Test',
      5,
      DiscountScope.all(),
      DiscountPolicy.percentage(15),
      { stackable: false },
    );
    const serialized = rule.serialize();
    expect(serialized.name).toBe('Test');
    expect(serialized.priority).toBe(5);
    expect(serialized.stackable).toBe(false);
    expect(serialized.policy.value).toBe(15);
  });
});
