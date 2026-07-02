import { describe, it, expect } from 'vitest';
import { DiscountConfiguration } from '../DiscountConfiguration';
import { DiscountRule } from '../DiscountRule';
import { DiscountScope } from '../DiscountScope';
import { DiscountPolicy } from '../DiscountPolicy';

describe('DiscountConfiguration', () => {
  it('creates config with empty rules', () => {
    const config = DiscountConfiguration.create({ tenantId: 'tenant_1', enabled: true, rules: [] });
    expect(config.getId()).toContain('disc_cfg_tenant_1');
    expect(config.isEnabled()).toBe(true);
    expect(config.getRules()).toHaveLength(0);
  });

  it('adds and removes rules', () => {
    const config = DiscountConfiguration.create({ tenantId: 't1', enabled: true, rules: [] });
    const rule = DiscountRule.new('Test', 10, DiscountScope.all(), DiscountPolicy.percentage(10));
    config.addRule(rule);
    expect(config.getRules()).toHaveLength(1);

    config.removeRule(rule.getId());
    expect(config.getRules()).toHaveLength(0);
  });

  it('enables and disables', () => {
    const config = DiscountConfiguration.create({ tenantId: 't1', enabled: true, rules: [] });
    config.disable();
    expect(config.isEnabled()).toBe(false);
    config.enable();
    expect(config.isEnabled()).toBe(true);
  });

  it('gets active rules only', () => {
    const config = DiscountConfiguration.create({ tenantId: 't1', enabled: true, rules: [] });
    const r1 = DiscountRule.new('Active', 10, DiscountScope.all(), DiscountPolicy.percentage(10));
    const r2 = DiscountRule.new('Inactive', 20, DiscountScope.all(), DiscountPolicy.percentage(5), { active: false });
    config.addRule(r1);
    config.addRule(r2);

    expect(config.getActiveRules()).toHaveLength(1);
    expect(config.getActiveRules()[0].name).toBe('Active');
  });
});
