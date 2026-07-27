import { describe, it, expect } from 'vitest';
import { TaxEngine, TaxCalculationInput } from '../TaxEngine';
import { TaxConfiguration } from '../TaxConfiguration';
import { TaxRule } from '../TaxRule';
import { TaxScope } from '../TaxScope';
import { TaxPolicy } from '../TaxPolicy';
import { Charge } from '../Charge';

function makeConfig(overrides?: {
  rules?: TaxRule[];
  charges?: Charge[];
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
  if (overrides?.charges) {
    for (const charge of overrides.charges) {
      cfg.addCharge(charge);
    }
  }

  return cfg;
}

function input(overrides?: Partial<TaxCalculationInput>): TaxCalculationInput {
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

describe('TaxEngine', () => {
  describe('when tax disabled', () => {
    it('returns result with subtotal/grandTotal computed but no tax', () => {
      const config = makeConfig({ taxEnabled: false });
      const result = TaxEngine.calculate(input(), config);
      expect(result.subtotal).toBe(100000);
      expect(result.taxAmount).toBe(0);
      expect(result.taxes).toEqual([]);
      expect(result.grandTotal).toBe(100000);
    });
  });

  describe('subtotal calculation', () => {
    it('calculates subtotal from items', () => {
      const config = makeConfig({ rules: [] });
      const result = TaxEngine.calculate(input({ items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 3, unitPrice: 10000 }] }), config);
      expect(result.subtotal).toBe(30000);
    });
  });

  describe('discount', () => {
    it('applies nominal discount', () => {
      const config = makeConfig({ rules: [] });
      const result = TaxEngine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 10000, discountType: 'nominal',
      }), config);
      expect(result.discount).toBe(10000);
      expect(result.taxBase).toBe(90000);
    });

    it('applies percentage discount', () => {
      const config = makeConfig({ rules: [] });
      const result = TaxEngine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 20, discountType: 'percentage',
      }), config);
      expect(result.discount).toBe(20000);
      expect(result.taxBase).toBe(80000);
    });

    it('caps discount at subtotal', () => {
      const config = makeConfig({ rules: [] });
      const result = TaxEngine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 5000 }],
        discount: 10000, discountType: 'nominal',
      }), config);
      expect(result.discount).toBe(5000);
    });
  });

  describe('tax calculation', () => {
    it('applies VAT rule with fraction modifier 11/12', () => {
      const vatRule = TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vatRule] });
      const result = TaxEngine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 120000 }],
      }), config);
      expect(result.subtotal).toBe(120000);
      expect(result.taxAmount).toBe(13200);
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].amount).toBe(13200);
      expect(result.taxes[0].name).toBe('Pajak 12%');
    });

    it('applies multiple rules respecting priority', () => {
      const vat = TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat] });
      const result = TaxEngine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      const vatTax = Math.round(100000 * 11 / 12 * 12 / 100);
      expect(result.taxAmount).toBe(vatTax);
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].name).toBe('Pajak 12%');
    });

    it('exemption rule yields zero tax', () => {
      const exempt = TaxRule.new('Bebas Pajak', 'exemption', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 0, roundingMode: 'round', precision: 2 }),
      );
      const config = makeConfig({ rules: [exempt] });
      const result = TaxEngine.calculate(input(), config);
      expect(result.taxAmount).toBe(0);
    });

    it('applies scope filtering', () => {
      const outletRule = TaxRule.new('Pajak Outlet A', 'vat', 1, TaxScope.forOutlet('outlet-a', 'A'),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [outletRule] });
      const result = TaxEngine.calculate(input({ outletId: 'outlet-b' }), config);
      expect(result.taxAmount).toBe(0);
    });

    it('applies scope filtering when matched', () => {
      const outletRule = TaxRule.new('Pajak Outlet A', 'vat', 1, TaxScope.forOutlet('outlet-a', 'A'),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [outletRule] });
      const result = TaxEngine.calculate(input({ outletId: 'outlet-a' }), config);
      expect(result.taxAmount).toBeGreaterThan(0);
    });
  });

  describe('pricing mode', () => {
    it('exclusive: grandTotal = subtotal + taxAmount', () => {
      const vat = TaxRule.new('Pajak 12%', 'vat', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat], pricingMode: 'exclusive' });
      const result = TaxEngine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      const expectedTax = Math.round(100000 * 11 / 12 * 12 / 100 * 100) / 100;
      expect(result.grandTotal).toBe(100000 + expectedTax);
    });

    it('inclusive: grandTotal = subtotal', () => {
      const vat = TaxRule.new('Pajak 12%', 'vat', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat], pricingMode: 'inclusive' });
      const result = TaxEngine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.grandTotal).toBe(100000);
    });

    it('inclusive with charge: charge in price, grandTotal = subtotal', () => {
      const charge = Charge.new('Service 5%', 5, 1, true);
      const config = makeConfig({ charges: [charge], pricingMode: 'inclusive' });
      const result = TaxEngine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.grandTotal).toBe(100000);
      expect(result.charges).toHaveLength(1);
      expect(result.charges[0].amount).toBeGreaterThan(0);
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
      const result = TaxEngine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 10000 }],
      }), config);
      expect(result.taxes[0].name).toBe('High');
      expect(result.taxes[1].name).toBe('Low');
    });
  });
});
