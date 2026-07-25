import { describe, it, expect } from 'vitest';
import { calculateTax, type TaxCalcInput } from '../../src/@shared/utils/taxCalculator';
import type { ITaxConfiguration } from '../../src/@shared/hooks/useTaxConfiguration';

function makeTaxConfig(overrides?: {
  precision?: number;
  roundingMode?: 'round' | 'floor' | 'ceil';
  taxEnabled?: boolean;
  pricingMode?: 'inclusive' | 'exclusive';
}): ITaxConfiguration {
  const now = new Date().toISOString();
  return {
    id: 'cfg-1',
    tenantId: 'tenant-test',
    taxEnabled: overrides?.taxEnabled ?? true,
    pricingMode: overrides?.pricingMode ?? 'exclusive',
    countryCode: 'ID',
    currency: 'IDR',
    activeVersionId: 'v1',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        effectiveDate: '2025-01-01',
        rules: [
          {
            id: 'tax-12',
            name: 'Pajak 12%',
            taxType: 'vat',
            scope: { type: 'all', entityId: '', entityName: '' },
            policy: {
              type: 'percentage',
              value: 12,
              roundingMode: overrides?.roundingMode ?? 'round',
              precision: overrides?.precision ?? 0,
            },
            modifier: {
              type: 'fraction',
              config: { numerator: 11, denominator: 12 },
            },
            priority: 10,
            isActive: true,
            effectiveDate: '2025-01-01',
          },
        ],
        status: 'active',
        createdAt: now,
      },
    ],
    metadata: {},
  };
}

function makeScTaxConfig(precision = 0): ITaxConfiguration {
  const now = new Date().toISOString();
  return {
    id: 'cfg-2',
    tenantId: 'tenant-test',
    taxEnabled: true,
    pricingMode: 'exclusive',
    countryCode: 'ID',
    currency: 'IDR',
    activeVersionId: 'v1',
    versions: [
      {
        id: 'v1',
        versionNumber: 1,
        effectiveDate: '2025-01-01',
        rules: [
          {
            id: 'sc-5',
            name: 'Service Charge 10%',
            taxType: 'service_charge',
            scope: { type: 'all', entityId: '', entityName: '' },
            policy: { type: 'percentage', value: 10, roundingMode: 'round', precision },
            priority: 5,
            isActive: true,
            effectiveDate: '2025-01-01',
          },
          {
            id: 'tax-12',
            name: 'Pajak 12%',
            taxType: 'vat',
            scope: { type: 'all', entityId: '', entityName: '' },
            policy: { type: 'percentage', value: 12, roundingMode: 'round', precision },
            modifier: {
              type: 'fraction',
              config: { numerator: 11, denominator: 12 },
            },
            priority: 10,
            isActive: true,
            effectiveDate: '2025-01-01',
          },
        ],
        status: 'active',
        createdAt: now,
      },
    ],
    metadata: {},
  };
}

function input(overrides?: Partial<TaxCalcInput>): TaxCalcInput {
  return {
    items: [
      { productId: 'p1', quantity: 1, unitPrice: overrides?.items?.[0]?.unitPrice ?? 100000 },
    ],
    discount: overrides?.discount ?? 0,
    discountType: overrides?.discountType ?? 'nominal',
  };
}

describe('taxCalculator — Pajak DPP Nilai Lain', () => {
  describe('modifier 11/12 with rate 12%', () => {
    const config = makeTaxConfig();

    it('Case 1: subtotal=100000 → tax=11000', () => {
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.totalTax).toBe(11000);
      expect(result.taxBreakdown[0].rate).toBe(12);
      expect(result.taxBreakdown[0].amount).toBe(11000);
    });

    it('Case 2: subtotal=120000 → tax=13200', () => {
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 120000 }],
      }), config);
      expect(result.totalTax).toBe(13200);
      expect(result.taxBreakdown[0].amount).toBe(13200);
    });

    it('Case 3: subtotal=25000 → tax=2750', () => {
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 25000 }],
      }), config);
      expect(result.totalTax).toBe(2750);
      expect(result.taxBreakdown[0].amount).toBe(2750);
    });

    it('engine uses policy.value=12, NOT effective rate 11', () => {
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 100000 }],
      }), config);
      expect(result.taxBreakdown[0].rate).toBe(12);
    });
  });

  describe('with service charge', () => {
    const config = makeScTaxConfig();

    it('Case 4a: SC included in DPP — Pajak on subtotal + SC', () => {
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 25000 }],
      }), config);

      const expectedSc = 25000 * 10 / 100;
      const dppBase = 25000 + expectedSc;
      const expectedPajak = Math.round(dppBase * 11 / 12 * 12 / 100);

      expect(result.serviceCharge).toBe(expectedSc);
      expect(result.taxBreakdown[1].baseAmount).toBe(dppBase);
      expect(result.totalTax - result.serviceCharge).toBe(expectedPajak);
      expect(result.grandTotal).toBe(25000 + expectedSc + expectedPajak);
    });
  });

  describe('with discount', () => {
    const config = makeTaxConfig();

    it('Pajak applies on discounted amount', () => {
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 100000 }],
        discount: 20000,
        discountType: 'nominal',
      }), config);

      const taxable = 80000;
      const expectedPajak = taxable * 11 / 12 * 12 / 100;
      expect(result.taxableAmount).toBe(taxable);
      expect(result.totalTax).toBe(Math.round(expectedPajak));
    });
  });

  describe('pricing mode inclusive', () => {
    const config = makeTaxConfig();

    it('inclusive: grandTotal equals taxableAmount (tax embedded)', () => {
      const inclusiveConfig = { ...config, pricingMode: 'inclusive' as const };
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 100000 }],
      }), inclusiveConfig);
      expect(result.grandTotal).toBe(100000);
      expect(result.totalTax).toBeGreaterThan(0);
    });
  });

  describe('inclusive SC extraction — various scenarios', () => {
    function makeInclusiveConfig(rules: Array<{
      id: string; name: string; taxType: string; value: number;
      modifier?: { type: string; config: Record<string, number> };
      priority?: number;
    }>): ITaxConfiguration {
      const now = new Date().toISOString();
      return {
        id: 'cfg-inclusive',
        tenantId: 'tenant-test',
        taxEnabled: true,
        pricingMode: 'inclusive',
        countryCode: 'ID',
        currency: 'IDR',
        activeVersionId: 'v1',
        versions: [{
          id: 'v1',
          versionNumber: 1,
          effectiveDate: '2025-01-01',
          rules: rules.map((r) => ({
            id: r.id,
            name: r.name,
            taxType: r.taxType,
            scope: { type: 'all', entityId: '', entityName: '' },
            policy: { type: 'percentage' as const, value: r.value, roundingMode: 'round' as const, precision: 0 },
            modifier: r.modifier ? { type: r.modifier.type, config: r.modifier.config } : undefined,
            priority: r.priority ?? (r.taxType === 'service_charge' ? 1 : 10),
            isActive: true,
            effectiveDate: '2025-01-01',
          })),
          status: 'active',
          createdAt: now,
        }],
        metadata: {},
      };
    }

    it('PPN only (no SC): extracts tax from price', () => {
      const cfg = makeInclusiveConfig([
        { id: 'ppn-12', name: 'PPN 12%', taxType: 'vat', value: 12 },
      ]);
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 25000 }],
      }), cfg);

      const expectedTax = Math.round(25000 - 25000 / (1 + 12 / 100));
      expect(result.grandTotal).toBe(25000);
      expect(result.serviceCharge).toBe(0);
      expect(result.totalTax).toBe(expectedTax);
    });

    it('SC only (no PPN): extracts SC from price', () => {
      const cfg = makeInclusiveConfig([
        { id: 'sc-10', name: 'SC 10%', taxType: 'service_charge', value: 10 },
      ]);
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 20000 }],
      }), cfg);

      const expectedSC = Math.round(20000 - 20000 / (1 + 10 / 100));
      expect(result.grandTotal).toBe(20000);
      expect(result.serviceCharge).toBe(expectedSC);
    });

    it('SC 10% + PPN 12%: DPP + SC + Tax = price (mathematical invariant)', () => {
      const cfg = makeInclusiveConfig([
        { id: 'sc-10', name: 'SC 10%', taxType: 'service_charge', value: 10 },
        { id: 'ppn-12', name: 'PPN 12%', taxType: 'vat', value: 12 },
      ]);
      const prices = [10000, 20000, 25000, 50000, 100000];
      for (const price of prices) {
        const result = calculateTax(input({
          items: [{ productId: 'p1', quantity: 1, unitPrice: price }],
        }), cfg);
        expect(result.grandTotal).toBe(price);
        expect(result.taxableAmount + result.serviceCharge + (result.totalTax - result.serviceCharge)).toBe(price);
      }
    });

    it('SC 10% + PPN 12% on Rp 20.000: matches Kopi Susu case', () => {
      const cfg = makeInclusiveConfig([
        { id: 'sc-10', name: 'SC 10%', taxType: 'service_charge', value: 10 },
        { id: 'ppn-12', name: 'PPN 12%', taxType: 'vat', value: 12 },
      ]);
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 20000 }],
      }), cfg);

      const expectedSC = Math.round(20000 - 20000 / (1 + 10 / 100));
      const remainingAfterSc = 20000 - expectedSC;
      const expectedTax = Math.round(remainingAfterSc - remainingAfterSc / (1 + 12 / 100));

      expect(result.grandTotal).toBe(20000);
      expect(result.serviceCharge).toBe(expectedSC);
      expect(result.taxableAmount).toBe(20000 - expectedSC - expectedTax);
    });

    it('SC 5% + PPN 12% fraction 11/12: cascading extraction', () => {
      const cfg = makeInclusiveConfig([
        { id: 'sc-5', name: 'SC 5%', taxType: 'service_charge', value: 5 },
        { id: 'ppn-12', name: 'PPN 12% (11/12)', taxType: 'vat', value: 12,
          modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } } },
      ]);
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 50000 }],
      }), cfg);

      expect(result.grandTotal).toBe(50000);
      expect(result.serviceCharge).toBeGreaterThan(0);
      expect(result.totalTax - result.serviceCharge).toBeGreaterThan(0);
    });

    it('breakdown contains both SC and tax entries', () => {
      const cfg = makeInclusiveConfig([
        { id: 'sc-5', name: 'SC 5%', taxType: 'service_charge', value: 5 },
        { id: 'ppn-12', name: 'PPN 12%', taxType: 'vat', value: 12 },
      ]);
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 100000 }],
      }), cfg);

      const scEntry = result.taxBreakdown.find((t) => t.taxType === 'service_charge');
      const taxEntry = result.taxBreakdown.find((t) => t.taxType === 'vat');
      expect(scEntry).toBeDefined();
      expect(taxEntry).toBeDefined();
      expect(scEntry!.amount).toBeGreaterThan(0);
      expect(taxEntry!.amount).toBeGreaterThan(0);
    });

    it('multiple items: each item extracts SC + PPN independently', () => {
      const cfg = makeInclusiveConfig([
        { id: 'sc-5', name: 'SC 5%', taxType: 'service_charge', value: 5 },
        { id: 'ppn-12', name: 'PPN 12%', taxType: 'vat', value: 12 },
      ]);
      const result = calculateTax({
        items: [
          { productId: 'p1', quantity: 1, unitPrice: 25000 },
          { productId: 'p2', quantity: 2, unitPrice: 20000 },
        ],
      }, cfg);

      expect(result.grandTotal).toBe(65000);
      expect(result.serviceCharge).toBeGreaterThan(0);
    });
  });
});
