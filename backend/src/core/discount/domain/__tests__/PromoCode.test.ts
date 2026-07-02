import { describe, it, expect } from 'vitest';
import { PromoCode } from '../PromoCode';

describe('PromoCode', () => {
  it('creates promo code with uppercase code', () => {
    const pc = PromoCode.new('t1', 'ramadan10', 'rule_1');
    expect(pc.getCode()).toBe('RAMADAN10');
    expect(pc.isActive()).toBe(true);
    expect(pc.isValid()).toBe(true);
  });

  it('detects expired promo code', () => {
    const pc = PromoCode.new('t1', 'expired', 'rule_1', { expiresAt: '2020-01-01' });
    expect(pc.isValid()).toBe(false);
  });

  it('detects maxed out promo code', () => {
    const pc = PromoCode.new('t1', 'limited', 'rule_1', { maxUsageCount: 5, currentUsageCount: 5 });
    expect(pc.isValid()).toBe(false);
  });

  it('deactivates promo code', () => {
    const pc = PromoCode.new('t1', 'stop', 'rule_1');
    pc.deactivate();
    expect(pc.isActive()).toBe(false);
    expect(pc.isValid()).toBe(false);
  });

  it('increments usage', () => {
    const pc = PromoCode.new('t1', 'cnt', 'rule_1');
    expect(pc.getCurrentUsageCount()).toBe(0);
    pc.incrementUsage();
    expect(pc.getCurrentUsageCount()).toBe(1);
  });
});
