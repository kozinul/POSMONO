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
    it('returns result with subtotal/grandTotal computed but no tax', () => {
      const config = makeConfig({ taxEnabled: false });
      const result = engine.calculate(input(), config);
      expect(result.subtotal).toBe(100000);
      expect(result.totalTax).toBe(0);
      expect(result.taxBreakdown).toEqual([]);
      expect(result.grandTotal).toBe(100000);
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
      const vatRule = TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
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
      const vat = TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat, serviceCharge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      const sc = 100000 * 5 / 100;
      const dppBase = 100000 + sc;
      const vatTax = Math.round(dppBase * 11 / 12 * 12 / 100);
      expect(result.serviceCharge).toBe(sc);
      expect(result.totalTax).toBe(sc + vatTax);
      expect(result.taxBreakdown).toHaveLength(2);
      expect(result.taxBreakdown[0].taxType).toBe('service_charge');
      expect(result.taxBreakdown[0].baseAmount).toBe(100000);
      expect(result.taxBreakdown[1].taxType).toBe('vat');
      expect(result.taxBreakdown[1].baseAmount).toBe(dppBase);
    });

    describe('Pajak DPP Nilai Lain with SC (Case 4)', () => {
      const pajakRule = (precision = 0) => TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const scRule = TaxRule.new('Service Charge 10%', 'service_charge', 5, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 10, roundingMode: 'round', precision: 0 }),
      );

      it('Case 4a: SC included in DPP — Pajak on subtotal + SC', () => {
        const config = makeConfig({ rules: [scRule, pajakRule()] });
        const result = engine.calculate(input({
          items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 25000 }],
        }), config);

        const expectedSc = 2500;
        const dppBase = 25000 + expectedSc;
        const expectedPajak = Math.round(dppBase * 11 / 12 * 12 / 100);
        expect(result.taxBreakdown[0].amount).toBe(expectedSc);
        expect(result.taxBreakdown[1].amount).toBe(expectedPajak);
        expect(result.taxBreakdown[1].baseAmount).toBe(dppBase);
        expect(result.totalTax).toBe(expectedSc + expectedPajak);
        expect(result.grandTotal).toBe(25000 + expectedSc + expectedPajak);
      });

      it('verifies engine uses policy.value=12, not effective rate 11', () => {
        const config = makeConfig({ rules: [pajakRule()] });
        const result = engine.calculate(input({
          items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 120000 }],
        }), config);

        expect(result.taxBreakdown[0].rate).toBe(12);
        expect(result.totalTax).toBe(13200);
      });
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
      const vat = TaxRule.new('Pajak 12%', 'vat', 1, TaxScope.all(),
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
      const vat = TaxRule.new('Pajak 12%', 'vat', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.grandTotal).toBe(100000);
    });

    it('inclusive with service charge: SC in price, grandTotal = subtotal', () => {
      const sc = TaxRule.new('Service 5%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 2 }),
      );
      const config = makeConfig({ rules: [sc], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.grandTotal).toBe(100000);
    });

    it('inclusive with fraction modifier: extracts tax from price using modified DPP', () => {
      const vat = TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      // DPP = 100000 * 11/12 = 91666.67
      // Tax extracted = 91666.67 - (91666.67 / 1.12) = 91666.67 - 81845.24 = 9821.43 → round = 9821
      const dpp = Math.round(100000 * 11 / 12);
      const expectedTax = Math.round(dpp - dpp / (1 + 12 / 100));
      expect(result.totalTax).toBe(expectedTax);
      expect(result.grandTotal).toBe(100000);
    });

    it('inclusive with SC + PPN fraction: SC and PPN extracted from price', () => {
      const sc = TaxRule.new('SC 5%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 0 }),
      );
      const vat = TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [sc, vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      // SC extracted from price: 100000 - 100000/1.05 = 4762
      // PPN extracted from remaining (100000 - 4762 = 95238) with fraction 11/12
      const scItem = Math.round(100000 - 100000 / (1 + 5 / 100));
      const remainingAfterSc = 100000 - scItem;
      const dpp = Math.round(remainingAfterSc * 11 / 12);
      const expectedPajak = Math.round(dpp * 12 / 112);
      expect(result.grandTotal).toBe(100000);
      expect(result.perItemTax?.['p1']?.serviceCharge).toBe(scItem);
      expect(result.perItemTax?.['p1']?.tax).toBe(expectedPajak);
      expect(result.totalTax).toBe(scItem + expectedPajak);
      expect(result.taxBreakdown.length).toBeGreaterThanOrEqual(2);
      expect(result.taxBreakdown[0].taxType).toBe('service_charge');
      expect(result.taxBreakdown[0].amount).toBe(scItem);
    });
  });

  describe('inclusive SC extraction — various scenarios', () => {
    it('inclusive with PPN only (no SC): extracts tax from price', () => {
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'Nasi Goreng', categoryId: 'cat-food', quantity: 1, unitPrice: 25000 }],
      }), config);

      const expectedTax = Math.round(25000 - 25000 / (1 + 12 / 100));
      const expectedDpp = 25000 - expectedTax;
      expect(result.grandTotal).toBe(25000);
      expect(result.perItemTax?.['p1']?.serviceCharge).toBe(0);
      expect(result.perItemTax?.['p1']?.tax).toBe(expectedTax);
      expect(result.perItemTax?.['p1']?.dpp).toBe(expectedDpp);
      expect(result.taxBreakdown).toHaveLength(1);
      expect(result.taxBreakdown[0].taxType).toBe('vat');
      expect(result.taxBreakdown[0].amount).toBe(expectedTax);
    });

    it('inclusive with SC only (no PPN): extracts SC from price', () => {
      const sc = TaxRule.new('SC 10%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 10, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [sc], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'Kopi Susu', categoryId: 'cat-drink', quantity: 1, unitPrice: 20000 }],
      }), config);

      const expectedSC = Math.round(20000 - 20000 / (1 + 10 / 100));
      const expectedDpp = 20000 - expectedSC;
      expect(result.grandTotal).toBe(20000);
      expect(result.perItemTax?.['p1']?.serviceCharge).toBe(expectedSC);
      expect(result.perItemTax?.['p1']?.tax).toBe(0);
      expect(result.perItemTax?.['p1']?.dpp).toBe(expectedDpp);
      expect(result.taxBreakdown).toHaveLength(1);
      expect(result.taxBreakdown[0].taxType).toBe('service_charge');
      expect(result.taxBreakdown[0].amount).toBe(expectedSC);
    });

    it('inclusive SC + PPN: DPP + SC + Tax = price (mathematical invariant)', () => {
      const sc = TaxRule.new('SC 5%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 0 }),
      );
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [sc, vat], pricingMode: 'inclusive' });

      const prices = [10000, 20000, 25000, 50000, 100000, 135000];
      for (const price of prices) {
        const result = engine.calculate(input({
          items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: price }],
        }), config);

        const item = result.perItemTax?.['p1']!;
        expect(result.grandTotal).toBe(price);
        expect(item.dpp + item.serviceCharge + item.tax).toBe(price);
      }
    });

    it('inclusive SC 10% + PPN 12% on Rp 20.000: matches Kopi Susu case', () => {
      const sc = TaxRule.new('SC 10%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 10, roundingMode: 'round', precision: 0 }),
      );
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [sc, vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'Kopi Susu', categoryId: 'cat-drink', quantity: 1, unitPrice: 20000 }],
      }), config);

      // SC: 20000 - 20000/1.10 = 20000 - 18181.82 = 1818.18 → round = 1818
      const expectedSC = Math.round(20000 - 20000 / (1 + 10 / 100));
      const remainingAfterSc = 20000 - expectedSC;
      // PPN: remainingAfterSc - remainingAfterSc/1.12
      const expectedTax = Math.round(remainingAfterSc - remainingAfterSc / (1 + 12 / 100));
      const expectedDpp = 20000 - expectedSC - expectedTax;

      expect(result.grandTotal).toBe(20000);
      expect(result.perItemTax?.['p1']?.serviceCharge).toBe(expectedSC);
      expect(result.perItemTax?.['p1']?.tax).toBe(expectedTax);
      expect(result.perItemTax?.['p1']?.dpp).toBe(expectedDpp);
      expect(expectedDpp + expectedSC + expectedTax).toBe(20000);
    });

    it('inclusive SC + PPN fraction 11/12: cascading extraction from price', () => {
      const sc = TaxRule.new('SC 5%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 0 }),
      );
      const vat = TaxRule.new('PPN 12% (11/12)', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [sc, vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 50000 }],
      }), config);

      const item = result.perItemTax?.['p1']!;
      expect(result.grandTotal).toBe(50000);
      expect(item.dpp + item.serviceCharge + item.tax).toBe(50000);
      expect(item.serviceCharge).toBeGreaterThan(0);
      expect(item.tax).toBeGreaterThan(0);
    });

    it('inclusive with discount: SC and tax extracted from discounted price', () => {
      const sc = TaxRule.new('SC 5%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 0 }),
      );
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [sc, vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 20000, discountType: 'nominal',
      }), config);

      // itemAmount = 100000 - 20000 = 80000
      // grandTotal for inclusive = itemAmount (discounted price, SC/tax embedded inside)
      const item = result.perItemTax?.['p1']!;
      expect(result.grandTotal).toBe(80000);
      expect(item.dpp + item.serviceCharge + item.tax).toBe(80000);
      expect(item.serviceCharge).toBeGreaterThan(0);
      expect(item.tax).toBeGreaterThan(0);
    });

    it('inclusive multiple items: each item extracts SC + PPN independently', () => {
      const sc = TaxRule.new('SC 5%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 0 }),
      );
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [sc, vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [
          { id: 'p1', productId: 'p1', productName: 'Nasi Goreng', categoryId: 'c1', quantity: 1, unitPrice: 25000 },
          { id: 'p2', productId: 'p2', productName: 'Kopi Susu', categoryId: 'c2', quantity: 2, unitPrice: 20000 },
        ],
      }), config);

      expect(result.grandTotal).toBe(65000);

      // p1: DPP + SC + Tax = 25000
      const item1 = result.perItemTax?.['p1']!;
      expect(item1.dpp + item1.serviceCharge + item1.tax).toBe(25000);

      // p2: DPP + SC + Tax = 40000 (2 x 20000)
      const item2 = result.perItemTax?.['p2']!;
      expect(item2.dpp + item2.serviceCharge + item2.tax).toBe(40000);
    });

    it('inclusive with per-item pricingMode override: item-level overrides global', () => {
      const sc = TaxRule.new('SC 5%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 0 }),
      );
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [sc, vat], pricingMode: 'exclusive' });
      const result = engine.calculate(input({
        items: [
          { id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 25000, pricingMode: 'inclusive' },
          { id: 'p2', productId: 'p2', productName: 'B', categoryId: 'c2', quantity: 1, unitPrice: 30000 },
        ],
      }), config);

      // p1 inclusive: grandTotal stays 25000
      const item1 = result.perItemTax?.['p1']!;
      expect(item1.dpp + item1.serviceCharge + item1.tax).toBe(25000);

      // p2 exclusive: grandTotal = price + SC + Tax
      const item2 = result.perItemTax?.['p2']!;
      expect(item2.serviceCharge).toBeGreaterThan(0);
      expect(item2.dpp).toBeGreaterThan(30000);
    });

    it('inclusive breakdown contains both SC and tax entries', () => {
      const sc = TaxRule.new('SC 5%', 'service_charge', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 5, roundingMode: 'round', precision: 0 }),
      );
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [sc, vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      expect(result.taxBreakdown).toHaveLength(2);
      const scEntry = result.taxBreakdown.find((t) => t.taxType === 'service_charge');
      const taxEntry = result.taxBreakdown.find((t) => t.taxType === 'vat');
      expect(scEntry).toBeDefined();
      expect(taxEntry).toBeDefined();
      expect(scEntry!.amount).toBeGreaterThan(0);
      expect(taxEntry!.amount).toBeGreaterThan(0);
    });

    it('inclusive with discount: tax extracted from discounted amount', () => {
      const vat = TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [vat], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 20000,
        discountType: 'nominal',
      }), config);
      // taxableAmount = 100000 - 20000 = 80000
      // Tax extracted = 80000 - 80000/1.12 = 80000 - 71428.57 = 8571.43 → round = 8571
      const expectedTax = Math.round(80000 - 80000 / (1 + 12 / 100));
      expect(result.totalTax).toBe(expectedTax);
      // grandTotal for inclusive = itemAmount (discounted price, tax embedded inside)
      expect(result.grandTotal).toBe(80000);
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
