import { describe, it, expect } from 'vitest';
import { PricingEngine, PricingInput } from '../PricingEngine';
import { TaxConfiguration } from '../TaxConfiguration';
import { TaxRule } from '../TaxRule';
import { TaxScope } from '../TaxScope';
import { TaxPolicy } from '../TaxPolicy';

function makeConfig(overrides?: {
  rules?: TaxRule[];
  pricingMode?: 'inclusive' | 'exclusive';
  taxEnabled?: boolean;
  tenantId?: string;
}): TaxConfiguration {
  const cfg = TaxConfiguration.create({
    tenantId: overrides?.tenantId ?? 'tenant-test-1',
    taxEnabled: overrides?.taxEnabled ?? true,
    pricingMode: overrides?.pricingMode ?? 'exclusive',
    countryCode: 'ID',
    currency: 'IDR',
    activeVersionId: '',
    versions: [],
    metadata: {},
  });

  if (overrides?.rules) {
    for (const rule of overrides.rules) {
      cfg.addRule(rule);
    }
  }

  return cfg;
}

function input(overrides?: Partial<PricingInput>): PricingInput {
  return {
    tenantId: 'tenant-test-1',
    items: [
      { id: 'p1', productId: 'p1', productName: 'Nasi Goreng', categoryId: 'cat-food', quantity: 2, unitPrice: 50000 },
    ],
    discount: 0,
    discountType: 'nominal',
    ...overrides,
  };
}

describe('PricingEngine', () => {
  const engine = new PricingEngine();

  describe('when tax disabled', () => {
    it('returns empty result with zero values', () => {
      const config = makeConfig({ taxEnabled: false });
      const result = engine.calculate(input(), config);
      expect(result.subtotal).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.taxBreakdown).toEqual([]);
      expect(result.grandTotal).toBe(0);
    });
  });

  describe('subtotal calculation', () => {
    it('calculates subtotal from items', () => {
      const config = makeConfig({ rules: [] });
      const result = engine.calculate(input({ items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 3, unitPrice: 10000 }] }), config);
      expect(result.subtotal).toBe(30000);
    });
  });

  describe('discount', () => {
    it('applies nominal discount', () => {
      const config = makeConfig({ rules: [] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 10000, discountType: 'nominal',
      }), config);
      expect(result.discountAmount).toBe(10000);
      expect(result.taxableAmount).toBe(90000);
    });

    it('applies percentage discount', () => {
      const config = makeConfig({ rules: [] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 20, discountType: 'percentage',
      }), config);
      expect(result.discountAmount).toBe(20000);
      expect(result.taxableAmount).toBe(80000);
    });

    it('caps discount at subtotal', () => {
      const config = makeConfig({ rules: [] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 5000 }],
        discount: 10000, discountType: 'nominal',
      }), config);
      expect(result.discountAmount).toBe(5000);
    });
  });

  describe('tax calculation with modifier', () => {
    it('applies VAT rule with fraction modifier 11/12', () => {
      const vatRule = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vatRule] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 120000 }],
      }), config);
      expect(result.subtotal).toBe(120000);
      expect(result.totalTax).toBe(13200);
      expect(result.taxBreakdown).toHaveLength(1);
      expect(result.taxBreakdown[0].amount).toBe(13200);
      expect(result.taxBreakdown[0].taxType).toBe('vat');
    });

    it('applies multiple rules respecting priority', () => {
      const serviceCharge = TaxRule.new('Service 5%', 'service_charge', 5, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 2 }),
      );
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat, serviceCharge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      const sc = 100000 * 5 / 100;
      const vatTax = Math.round(100000 * 11 / 12 * 12 / 100 * 100) / 100;
      expect(result.totalTax).toBe(sc + vatTax);
      expect(result.taxBreakdown).toHaveLength(2);
      expect(result.taxBreakdown[0].taxType).toBe('service_charge');
      expect(result.taxBreakdown[1].taxType).toBe('vat');
    });

    it('applies no modifier when none specified', () => {
      const rule = TaxRule.new('Flat 10%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 10, roundingMode: 'round', precision: 2 }),
      );
      const config = makeConfig({ rules: [rule] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.totalTax).toBe(10000);
    });

    it('applies multiplier modifier', () => {
      const rule = TaxRule.new('80% taxable', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 10, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'multiplier', config: { multiplier: 0.8 } } },
      );
      const config = makeConfig({ rules: [rule] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.totalTax).toBe(8000);
    });
  });

  describe('exemption', () => {
    it('exemption rule yields zero tax', () => {
      const exempt = TaxRule.new('Bebas Pajak', 'exemption', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 0, roundingMode: 'round', precision: 2 }),
      );
      const config = makeConfig({ rules: [exempt] });
      const result = engine.calculate(input(), config);
      expect(result.totalTax).toBe(0);
    });
  });

  describe('scope filtering', () => {
    it('does not apply when scope does not match', () => {
      const outletRule = TaxRule.new('Pajak Outlet A', 'vat', 1, TaxScope.forOutlet('outlet-a', 'A'),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [outletRule] });
      const result = engine.calculate(input({ outletId: 'outlet-b' }), config);
      expect(result.totalTax).toBe(0);
    });

    it('applies when scope matches', () => {
      const outletRule = TaxRule.new('Pajak Outlet A', 'vat', 1, TaxScope.forOutlet('outlet-a', 'A'),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [outletRule] });
      const result = engine.calculate(input({ outletId: 'outlet-a' }), config);
      expect(result.totalTax).toBeGreaterThan(0);
    });
  });

  describe('pricing mode', () => {
    it('exclusive: grandTotal = subtotal + totalTax', () => {
      const vat = TaxRule.new('PPN 12%', 'vat', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat], pricingMode: 'exclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      const expectedTax = Math.round(100000 * 11 / 12 * 12 / 100 * 100) / 100;
      expect(result.grandTotal).toBe(100000 + expectedTax);
    });

    it('inclusive: grandTotal = subtotal + serviceCharge only', () => {
      const vat = TaxRule.new('PPN 12%', 'vat', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.grandTotal).toBe(100000);
    });

    it('inclusive with service charge: grandTotal = subtotal + serviceCharge', () => {
      const sc = TaxRule.new('Service 5%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 2 }),
      );
      const config = makeConfig({ rules: [sc], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.grandTotal).toBe(100000 + 5000);
    });
  });

  describe('rule priority ordering', () => {
    it('sorts rules by priority ascending', () => {
      const low = TaxRule.new('Low', 'vat', 20, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 11, roundingMode: 'round', precision: 2 }),
      );
      const high = TaxRule.new('High', 'vat', 5, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 11, roundingMode: 'round', precision: 2 }),
      );
      const config = makeConfig({ rules: [low, high] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 10000 }],
      }), config);
      expect(result.taxBreakdown[0].priority).toBe(5);
      expect(result.taxBreakdown[1].priority).toBe(20);
    });
  });
});
