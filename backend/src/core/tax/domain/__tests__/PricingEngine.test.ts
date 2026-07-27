import { describe, it, expect } from 'vitest';
import { PricingEngine, PricingInput } from '../PricingEngine';
import { TaxConfiguration } from '../TaxConfiguration';
import { TaxRule } from '../TaxRule';
import { TaxScope } from '../TaxScope';
import { TaxPolicy } from '../TaxPolicy';
import { Charge, ICharge } from '../Charge';

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

function scCharge(rate: number, priority = 5, includeInTaxBase = true, overrides?: Partial<ICharge>): Charge {
  return Charge.new(`Service Charge ${rate}%`, rate, priority, includeInTaxBase, overrides);
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
      expect(result.taxAmount).toBe(0);
      expect(result.taxes).toEqual([]);
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
      expect(result.discount).toBe(10000);
      expect(result.taxBase).toBe(90000);
    });

    it('applies percentage discount', () => {
      const config = makeConfig({ rules: [] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 20, discountType: 'percentage',
      }), config);
      expect(result.discount).toBe(20000);
      expect(result.taxBase).toBe(80000);
    });

    it('caps discount at subtotal', () => {
      const config = makeConfig({ rules: [] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 5000 }],
        discount: 10000, discountType: 'nominal',
      }), config);
      expect(result.discount).toBe(5000);
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
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      const vatTax = Math.round(100000 * 11 / 12 * 12 / 100);
      expect(result.taxAmount).toBe(vatTax);
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].name).toBe('Pajak 12%');
    });

    describe('Pajak DPP Nilai Lain with Charge (Case 4)', () => {
      const pajakRule = (precision = 0) => TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );

      it('Case 4a: Charge included in DPP — Pajak on subtotal + charge', () => {
        const charge = scCharge(10, 5, true);
        const config = makeConfig({ rules: [pajakRule()], charges: [charge] });
        const result = engine.calculate(input({
          items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 25000 }],
        }), config);

        const expectedCharge = 2500;
        const dppBase = 25000 + expectedCharge;
        const expectedPajak = Math.round(dppBase * 11 / 12 * 12 / 100);
        expect(result.charges).toHaveLength(1);
        expect(result.charges[0].amount).toBe(expectedCharge);
        expect(result.taxes).toHaveLength(1);
        expect(result.taxes[0].amount).toBe(expectedPajak);
        expect(result.taxAmount).toBe(expectedPajak);
        expect(result.grandTotal).toBe(25000 + expectedCharge + expectedPajak);
      });

      it('verifies engine uses policy.value=12, not effective rate 11', () => {
        const config = makeConfig({ rules: [pajakRule()] });
        const result = engine.calculate(input({
          items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 120000 }],
        }), config);

        expect(result.taxes[0].rate).toBe(12);
        expect(result.taxAmount).toBe(13200);
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
      expect(result.taxAmount).toBe(10000);
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
      expect(result.taxAmount).toBe(8000);
    });
  });

  describe('exemption', () => {
    it('exemption rule yields zero tax', () => {
      const exempt = TaxRule.new('Bebas Pajak', 'exemption', 1, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 0, roundingMode: 'round', precision: 2 }),
      );
      const config = makeConfig({ rules: [exempt] });
      const result = engine.calculate(input(), config);
      expect(result.taxAmount).toBe(0);
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
      expect(result.taxAmount).toBe(0);
    });

    it('applies when scope matches', () => {
      const outletRule = TaxRule.new('Pajak Outlet A', 'vat', 1, TaxScope.forOutlet('outlet-a', 'A'),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 2 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [outletRule] });
      const result = engine.calculate(input({ outletId: 'outlet-a' }), config);
      expect(result.taxAmount).toBeGreaterThan(0);
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

    it('inclusive: grandTotal = subtotal', () => {
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

    it('inclusive with charge: charge extracted from price, grandTotal = subtotal', () => {
      const charge = scCharge(5, 1, true);
      const config = makeConfig({ charges: [charge], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.grandTotal).toBe(100000);
      expect(result.charges).toHaveLength(1);
      expect(result.charges[0].amount).toBeGreaterThan(0);
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
      const dpp = Math.round(100000 * 11 / 12);
      const expectedTax = Math.round(dpp - dpp / (1 + 12 / 100));
      expect(result.taxAmount).toBe(expectedTax);
      expect(result.grandTotal).toBe(100000);
    });

    it('inclusive with Charge + PPN fraction: Charge and PPN extracted from price', () => {
      const charge = scCharge(5, 1, true);
      const vat = TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat], charges: [charge], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      const chargeItem = Math.round(100000 - 100000 / (1 + 5 / 100));
      const remainingAfterCharge = 100000 - chargeItem;
      const dpp = Math.round(remainingAfterCharge * 11 / 12);
      const expectedPajak = Math.round(dpp * 12 / 112);
      expect(result.grandTotal).toBe(100000);
      expect(result.charges[0].amount).toBe(chargeItem);
      expect(result.taxAmount).toBe(expectedPajak);
      expect(result.taxes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('inclusive Charge extraction — various scenarios', () => {
    it('inclusive with PPN only (no charge): extracts tax from price', () => {
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
      expect(result.charges).toHaveLength(0);
      expect(result.taxAmount).toBe(expectedTax);
      expect(result.taxBase).toBe(expectedDpp);
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].name).toBe('PPN 12%');
      expect(result.taxes[0].amount).toBe(expectedTax);
    });

    it('inclusive with Charge only (no PPN): extracts charge from price', () => {
      const charge = scCharge(10, 1, true);
      const config = makeConfig({ charges: [charge], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'Kopi Susu', categoryId: 'cat-drink', quantity: 1, unitPrice: 20000 }],
      }), config);

      const expectedCharge = Math.round(20000 - 20000 / (1 + 10 / 100));
      const expectedDpp = 20000 - expectedCharge;
      expect(result.grandTotal).toBe(20000);
      expect(result.charges).toHaveLength(1);
      expect(result.charges[0].amount).toBe(expectedCharge);
      expect(result.taxAmount).toBe(0);
      expect(result.taxBase).toBe(expectedDpp);
    });

    it('inclusive Charge + PPN: DPP + Charge + Tax = price (mathematical invariant)', () => {
      const charge = scCharge(5, 1, true);
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [vat], charges: [charge], pricingMode: 'inclusive' });

      const prices = [10000, 20000, 25000, 50000, 100000, 135000];
      for (const price of prices) {
        const result = engine.calculate(input({
          items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: price }],
        }), config);

        const chargeAmt = result.charges.reduce((s, c) => s + c.amount, 0);
        expect(result.grandTotal).toBe(price);
        expect(result.taxBase + chargeAmt + (result.taxAmount)).toBe(price);
      }
    });

    it('inclusive Charge 10% + PPN 12% on Rp 20.000: matches Kopi Susu case', () => {
      const charge = scCharge(10, 1, true);
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [vat], charges: [charge], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'Kopi Susu', categoryId: 'cat-drink', quantity: 1, unitPrice: 20000 }],
      }), config);

      const expectedCharge = Math.round(20000 - 20000 / (1 + 10 / 100));
      const remainingAfterCharge = 20000 - expectedCharge;
      const expectedTax = Math.round(remainingAfterCharge - remainingAfterCharge / (1 + 12 / 100));
      const expectedDpp = 20000 - expectedCharge - expectedTax;

      expect(result.grandTotal).toBe(20000);
      expect(result.charges[0].amount).toBe(expectedCharge);
      expect(result.taxAmount).toBe(expectedTax);
      expect(result.taxBase).toBe(expectedDpp);
      expect(expectedDpp + expectedCharge + expectedTax).toBe(20000);
    });

    it('inclusive Charge + PPN fraction 11/12: cascading extraction from price', () => {
      const charge = scCharge(5, 1, true);
      const vat = TaxRule.new('PPN 12% (11/12)', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
        { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      );
      const config = makeConfig({ rules: [vat], charges: [charge], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 50000 }],
      }), config);

      expect(result.grandTotal).toBe(50000);
      const chargeAmt = result.charges.reduce((s, c) => s + c.amount, 0);
      expect(result.taxBase + chargeAmt + result.taxAmount).toBe(50000);
      expect(chargeAmt).toBeGreaterThan(0);
      expect(result.taxAmount).toBeGreaterThan(0);
    });

    it('inclusive with discount: charges and tax extracted from discounted price', () => {
      const charge = scCharge(5, 1, true);
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [vat], charges: [charge], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 20000, discountType: 'nominal',
      }), config);

      const chargeAmt = result.charges.reduce((s, c) => s + c.amount, 0);
      expect(result.grandTotal).toBe(80000);
      expect(result.taxBase + chargeAmt + result.taxAmount).toBe(80000);
      expect(chargeAmt).toBeGreaterThan(0);
      expect(result.taxAmount).toBeGreaterThan(0);
    });

    it('inclusive multiple items: each item extracts Charge + PPN independently', () => {
      const charge = scCharge(5, 1, true);
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [vat], charges: [charge], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [
          { id: 'p1', productId: 'p1', productName: 'Nasi Goreng', categoryId: 'c1', quantity: 1, unitPrice: 25000 },
          { id: 'p2', productId: 'p2', productName: 'Kopi Susu', categoryId: 'c2', quantity: 2, unitPrice: 20000 },
        ],
      }), config);

      expect(result.grandTotal).toBe(65000);
    });

    it('inclusive with per-item pricingMode override: item-level overrides global', () => {
      const charge = scCharge(5, 1, true);
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [vat], charges: [charge], pricingMode: 'exclusive' });
      const result = engine.calculate(input({
        items: [
          { id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 25000, pricingMode: 'inclusive' },
          { id: 'p2', productId: 'p2', productName: 'B', categoryId: 'c2', quantity: 1, unitPrice: 30000 },
        ],
      }), config);

      expect(result.charges).toHaveLength(1);
      expect(result.charges[0].amount).toBeGreaterThan(0);
    });

    it('inclusive breakdown contains both Charge and tax entries', () => {
      const charge = scCharge(5, 1, true);
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [vat], charges: [charge], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      expect(result.charges).toHaveLength(1);
      expect(result.taxes).toHaveLength(1);
      expect(result.charges[0].amount).toBeGreaterThan(0);
      expect(result.taxes[0].amount).toBeGreaterThan(0);
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
      const expectedTax = Math.round(80000 - 80000 / (1 + 12 / 100));
      expect(result.taxAmount).toBe(expectedTax);
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
      expect(result.taxes[0].name).toBe('High');
      expect(result.taxes[1].name).toBe('Low');
    });
  });

  describe('Charge includeInTaxBase (DPP)', () => {
    const pajakRule = (precision = 0) => TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
      TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision }),
      { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
    );

    it('without Charge: no charge in DPP', () => {
      const config = makeConfig({ rules: [pajakRule()] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.charges).toHaveLength(0);
      expect(result.taxBase).toBe(100000);
      const expectedTax = Math.round(100000 * 11 / 12 * 12 / 100);
      expect(result.taxAmount).toBe(expectedTax);
      expect(result.grandTotal).toBe(100000 + expectedTax);
    });

    it('Charge includeInTaxBase = true: charge part of DPP (Case 1)', () => {
      const charge = scCharge(10, 5, true);
      const config = makeConfig({ rules: [pajakRule()], charges: [charge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      const expectedCharge = 10000;
      const dppBase = 100000 + expectedCharge;
      const expectedPajak = Math.round(dppBase * 11 / 12 * 12 / 100);

      expect(result.charges[0].includeInTaxBase).toBe(true);
      expect(result.charges[0].amount).toBe(expectedCharge);
      expect(result.taxBase).toBe(dppBase);
      expect(result.taxAmount).toBe(expectedPajak);
      expect(result.grandTotal).toBe(100000 + expectedCharge + expectedPajak);
    });

    it('Charge includeInTaxBase = false: charge not in DPP (Case 2)', () => {
      const charge = scCharge(10, 5, false);
      const config = makeConfig({ rules: [pajakRule()], charges: [charge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      const expectedCharge = 10000;
      const dppBase = 100000;
      const expectedPajak = Math.round(dppBase * 11 / 12 * 12 / 100);

      expect(result.charges[0].includeInTaxBase).toBe(false);
      expect(result.charges[0].amount).toBe(expectedCharge);
      expect(result.taxBase).toBe(dppBase);
      expect(result.taxAmount).toBe(expectedPajak);
      expect(result.grandTotal).toBe(100000 + expectedCharge + expectedPajak);
    });

    it('Charge includeInTaxBase = true with discount: DPP = afterDiscount + charge', () => {
      const charge = scCharge(10, 5, true);
      const config = makeConfig({ rules: [pajakRule()], charges: [charge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 10000, discountType: 'nominal',
      }), config);

      const afterDiscount = 90000;
      const expectedCharge = 9000;
      const dppBase = afterDiscount + expectedCharge;
      const expectedPajak = Math.round(dppBase * 11 / 12 * 12 / 100);

      expect(result.subtotal).toBe(100000);
      expect(result.discount).toBe(10000);
      expect(result.charges[0].includeInTaxBase).toBe(true);
      expect(result.charges[0].amount).toBe(expectedCharge);
      expect(result.taxBase).toBe(dppBase);
      expect(result.grandTotal).toBe(afterDiscount + expectedCharge + expectedPajak);
    });

    it('modifier 11/12 + Charge includeInTaxBase = true: base = (afterDiscount+charge) x 11/12', () => {
      const charge = scCharge(10, 5, true);
      const config = makeConfig({ rules: [pajakRule()], charges: [charge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 10000, discountType: 'nominal',
      }), config);

      const afterDiscount = 90000;
      const expectedCharge = 9000;
      const dppBase = afterDiscount + expectedCharge;
      const modifierBase = Math.round(dppBase * 11 / 12);
      const expectedPajak = Math.round(modifierBase * 12 / 100);

      expect(result.taxBase).toBe(dppBase);
      expect(result.modifier.before).toBe(dppBase);
      expect(result.modifier.after).toBe(modifierBase);
      expect(result.taxAmount).toBe(expectedPajak);
      expect(result.grandTotal).toBe(afterDiscount + expectedCharge + expectedPajak);
    });

    it('without modifier + Charge includeInTaxBase = true: base = DPP directly', () => {
      const charge = scCharge(10, 5, true);
      const vatNoMod = TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [vatNoMod], charges: [charge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      const expectedCharge = 10000;
      const dppBase = 100000 + expectedCharge;
      const expectedPajak = Math.round(dppBase * 12 / 100);

      expect(result.taxBase).toBe(dppBase);
      expect(result.modifier.before).toBe(dppBase);
      expect(result.modifier.after).toBe(dppBase);
      expect(result.taxAmount).toBe(expectedPajak);
      expect(result.grandTotal).toBe(100000 + expectedCharge + expectedPajak);
    });

    it('concrete Case 1: subtotal=100000, discount=10000, charge=10%, includeInDPP=true', () => {
      const charge = scCharge(10, 5, true);
      const config = makeConfig({ rules: [pajakRule()], charges: [charge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 10000, discountType: 'nominal',
      }), config);

      expect(result.subtotal).toBe(100000);
      expect(result.discount).toBe(10000);
      expect(result.charges[0].amount).toBe(9000);
      expect(result.taxBase).toBe(99000);
      expect(result.modifier.before).toBe(99000);
      expect(result.modifier.after).toBe(Math.round(99000 * 11 / 12));
      expect(result.taxAmount).toBe(Math.round(99000 * 11 / 12 * 12 / 100));
      expect(result.grandTotal).toBe(90000 + 9000 + Math.round(99000 * 11 / 12 * 12 / 100));
    });

    it('concrete Case 2: subtotal=100000, discount=10000, charge=10%, includeInDPP=false', () => {
      const charge = scCharge(10, 5, false);
      const config = makeConfig({ rules: [pajakRule()], charges: [charge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 10000, discountType: 'nominal',
      }), config);

      expect(result.subtotal).toBe(100000);
      expect(result.discount).toBe(10000);
      expect(result.charges[0].amount).toBe(9000);
      expect(result.taxBase).toBe(90000);
      expect(result.modifier.before).toBe(90000);
      expect(result.modifier.after).toBe(Math.round(90000 * 11 / 12));
      expect(result.taxAmount).toBe(Math.round(90000 * 11 / 12 * 12 / 100));
      expect(result.grandTotal).toBe(90000 + 9000 + Math.round(90000 * 11 / 12 * 12 / 100));
    });
  });

  describe('multiple charges', () => {
    it('calculates multiple charges with different includeInTaxBase', () => {
      const deliveryCharge = Charge.flat('Delivery Fee', 5000, 3, false);
      const serviceCharge = scCharge(10, 5, true);
      const config = makeConfig({ rules: [pajakRule()], charges: [deliveryCharge, serviceCharge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      expect(result.charges).toHaveLength(2);
      const delivery = result.charges.find((c) => c.name === 'Delivery Fee');
      const service = result.charges.find((c) => c.name.startsWith('Service'));
      expect(delivery).toBeDefined();
      expect(delivery!.amount).toBe(5000);
      expect(delivery!.includeInTaxBase).toBe(false);
      expect(service).toBeDefined();
      expect(service!.amount).toBe(10000);
      expect(service!.includeInTaxBase).toBe(true);

      expect(result.taxBase).toBe(110000);
      expect(result.grandTotal).toBe(100000 + 5000 + 10000 + result.taxAmount);
    });
  });

  const pajakRule = (precision = 0) => TaxRule.new('Pajak 12%', 'vat', 10, TaxScope.all(),
    TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision }),
    { modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
  );

  describe('adjustments[] output', () => {
    it('exclusive with discount + charge + tax produces adjustments', () => {
      const charge = scCharge(10, 5, true);
      const config = makeConfig({ rules: [pajakRule()], charges: [charge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 10000, discountType: 'nominal',
      }), config);

      expect(result.adjustments).toBeDefined();
      expect(result.adjustments.length).toBeGreaterThanOrEqual(3);

      const discountAdj = result.adjustments.find((a) => a.type === 'DISCOUNT');
      expect(discountAdj).toBeDefined();
      expect(discountAdj!.amount).toBe(-10000);

      const chargeAdj = result.adjustments.find((a) => a.type === 'CHARGE');
      expect(chargeAdj).toBeDefined();
      expect(chargeAdj!.amount).toBe(9000);
      expect(chargeAdj!.affectsTaxBase).toBe(true);

      const taxAdj = result.adjustments.find((a) => a.type === 'TAX');
      expect(taxAdj).toBeDefined();
      expect(taxAdj!.amount).toBeGreaterThan(0);
    });

    it('inclusive with charge + tax produces adjustments', () => {
      const charge = scCharge(5, 1, true);
      const vat = TaxRule.new('PPN 12%', 'vat', 10, TaxScope.all(),
        TaxPolicy.create({ type: 'rate', value: 12, roundingMode: 'round', precision: 0 }),
      );
      const config = makeConfig({ rules: [vat], charges: [charge], pricingMode: 'inclusive' });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
      }), config);

      expect(result.adjustments.length).toBeGreaterThanOrEqual(2);
      expect(result.grandTotal).toBe(100000);

      const chargeAdj = result.adjustments.find((a) => a.type === 'CHARGE');
      expect(chargeAdj).toBeDefined();
      expect(chargeAdj!.amount).toBeGreaterThan(0);

      const taxAdj = result.adjustments.find((a) => a.type === 'TAX');
      expect(taxAdj).toBeDefined();
      expect(taxAdj!.amount).toBeGreaterThan(0);
    });

    it('adjustments are sorted by sequence', () => {
      const charge = scCharge(10, 5, true);
      const config = makeConfig({ rules: [pajakRule()], charges: [charge] });
      const result = engine.calculate(input({
        items: [{ id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 }],
        discount: 10000, discountType: 'nominal',
      }), config);

      for (let i = 1; i < result.adjustments.length; i++) {
        expect(result.adjustments[i].sequence).toBeGreaterThanOrEqual(result.adjustments[i - 1].sequence);
      }
    });

    it('tax disabled returns empty adjustments', () => {
      const config = makeConfig({ taxEnabled: false });
      const result = engine.calculate(input(), config);
      expect(result.adjustments).toEqual([]);
    });
  });
});
