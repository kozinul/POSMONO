import { describe, it, expect } from 'vitest';
import { TaxRule } from '../TaxRule';
import { TaxScope } from '../TaxScope';
import { TaxPolicy } from '../TaxPolicy';

function makeVatRule(overrides?: Record<string, any>): TaxRule {
  return TaxRule.new(
    overrides?.name ?? 'PPN 11%',
    overrides?.taxType ?? 'vat',
    overrides?.priority ?? 10,
    overrides?.scope ?? TaxScope.all(),
    overrides?.policy ?? TaxPolicy.create({ type: 'percentage_of_base', value: 11, roundingMode: 'round', precision: 2 }),
    {
      modifier: overrides?.modifier ?? { type: 'fraction', config: { numerator: 11, denominator: 12 } },
      isActive: overrides?.isActive ?? true,
      effectiveDate: overrides?.effectiveDate ?? new Date('2025-01-01'),
      expiresAt: overrides?.expiresAt,
      conditions: overrides?.conditions,
    },
  );
}

describe('TaxRule', () => {
  describe('create', () => {
    it('creates rule from serialized data', () => {
      const rule = makeVatRule();
      const serialized = rule.serialize();
      const restored = TaxRule.create(serialized);
      expect(restored.getId()).toBe(rule.getId());
      expect(restored.getName()).toBe('PPN 11%');
      expect(restored.getTaxType()).toBe('vat');
      expect(restored.getPriority()).toBe(10);
    });
  });

  describe('getModifier', () => {
    it('returns modifier config', () => {
      const rule = makeVatRule({ modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } });
      expect(rule.getModifier()).toEqual({ type: 'fraction', config: { numerator: 11, denominator: 12 } });
    });

    it('returns undefined when no modifier', () => {
      const rule = TaxRule.new('Simple', 'vat', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 10, roundingMode: 'round', precision: 2 }),
      );
      expect(rule.getModifier()).toBeUndefined();
    });
  });

  describe('isEnabled', () => {
    it('returns true for active rule with valid dates', () => {
      const rule = makeVatRule();
      expect(rule.isEnabled()).toBe(true);
    });

    it('returns false when isActive is false', () => {
      const rule = makeVatRule({ isActive: false });
      expect(rule.isEnabled()).toBe(false);
    });

    it('returns false when before effectiveDate', () => {
      const rule = makeVatRule({ effectiveDate: new Date('2099-01-01') });
      expect(rule.isEnabled()).toBe(false);
    });

    it('returns false when past expiresAt', () => {
      const rule = makeVatRule({ expiresAt: new Date('2020-01-01') });
      expect(rule.isEnabled()).toBe(false);
    });
  });

  describe('isExemption', () => {
    it('returns true for exemption type', () => {
      const rule = TaxRule.new('Bebas Pajak', 'exemption', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 0, roundingMode: 'round', precision: 2 }),
      );
      expect(rule.isExemption()).toBe(true);
    });

    it('returns false for vat type', () => {
      expect(makeVatRule().isExemption()).toBe(false);
    });
  });

  describe('isServiceCharge', () => {
    it('returns true for service_charge type', () => {
      const rule = TaxRule.new('Service Charge', 'service_charge', 5, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 2 }),
      );
      expect(rule.isServiceCharge()).toBe(true);
    });
  });

  describe('shouldApply', () => {
    it('returns true when scope matches and enabled', () => {
      const rule = makeVatRule();
      expect(rule.shouldApply({ items: [{ productId: 'p1', categoryId: 'c1' }] })).toBe(true);
    });

    it('returns false when disabled', () => {
      const rule = makeVatRule({ isActive: false });
      expect(rule.shouldApply({})).toBe(false);
    });

    it('returns false when scope does not match', () => {
      const rule = TaxRule.new('Outlet Only', 'vat', 1, TaxScope.forOutlet('outlet-a', 'A'),
        TaxPolicy.create({ type: 'rate', value: 11, roundingMode: 'round', precision: 2 }),
      );
      expect(rule.shouldApply({ outletId: 'outlet-b' })).toBe(false);
    });

    it('respects amount threshold condition', () => {
      const rule = TaxRule.new('Min Belanja', 'vat', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 11, roundingMode: 'round', precision: 2 }),
        {
          conditions: { amountOperator: 'greater_than', amountThreshold: 10000 },
        },
      );
      expect(rule.shouldApply({ items: [{ productId: 'p1', categoryId: 'c1', unitPrice: 5000, quantity: 1 } as any] })).toBe(false);
    });
  });

  describe('calculateTax', () => {
    it('calculates VAT with fraction modifier 11/12', () => {
      const rule = makeVatRule();
      const tax = rule.calculateTax(120000);
      expect(tax).toBe(12100);
    });

    it('returns 0 for exemption', () => {
      const rule = TaxRule.new('Bebas', 'exemption', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 0, roundingMode: 'round', precision: 2 }),
      );
      expect(rule.calculateTax(100000)).toBe(0);
    });

    it('handles amount type policy', () => {
      const rule = TaxRule.new('Fixed Tax', 'custom', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'amount', value: 5000, roundingMode: 'round', precision: 0 }),
      );
      expect(rule.calculateTax(100000)).toBe(5000);
    });

    it('calculates without modifier when none specified', () => {
      const rule = TaxRule.new('Flat 10%', 'vat', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 10, roundingMode: 'round', precision: 2 }),
      );
      expect(rule.calculateTax(100000)).toBe(10000);
    });
  });

  describe('serialize', () => {
    it('returns a copy of rule data', () => {
      const rule = makeVatRule();
      const s = rule.serialize();
      expect(s.id).toBe(rule.getId());
      expect(s.name).toBe('PPN 11%');
      expect(s.taxType).toBe('vat');
      expect(s.modifier).toEqual({ type: 'fraction', config: { numerator: 11, denominator: 12 } });
    });
  });
});
