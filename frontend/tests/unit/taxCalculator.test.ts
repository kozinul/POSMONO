import { describe, it, expect } from 'vitest';
import { calculateTax, type TaxCalcInput } from '../../src/@shared/utils/taxCalculator';
import type { ITaxConfiguration } from '../../src/@shared/hooks/useTaxConfiguration';

function makePpnConfig(overrides?: {
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
            id: 'ppn-12',
            name: 'PPN 12%',
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

function makeScPpnConfig(precision = 0): ITaxConfiguration {
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
            id: 'ppn-12',
            name: 'PPN 12%',
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

describe('taxCalculator — PPN DPP Nilai Lain', () => {
  describe('modifier 11/12 with rate 12%', () => {
    const config = makePpnConfig();

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
    const config = makeScPpnConfig();

    it('Case 4a: SC not in DPP — PPN on item subtotal only', () => {
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 25000 }],
      }), config);

      const expectedSc = 25000 * 10 / 100;
      const expectedPpn = 25000 * 11 / 12 * 12 / 100;

      expect(result.serviceCharge).toBe(expectedSc);
      expect(result.totalTax - result.serviceCharge).toBe(Math.round(expectedPpn));
      expect(result.grandTotal).toBe(25000 + expectedSc + Math.round(expectedPpn));
    });
  });

  describe('with discount', () => {
    const config = makePpnConfig();

    it('PPN applies on discounted amount', () => {
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 100000 }],
        discount: 20000,
        discountType: 'nominal',
      }), config);

      const taxable = 80000;
      const expectedPpn = taxable * 11 / 12 * 12 / 100;
      expect(result.taxableAmount).toBe(taxable);
      expect(result.totalTax).toBe(Math.round(expectedPpn));
    });
  });

  describe('pricing mode inclusive', () => {
    const config = makePpnConfig();

    it('inclusive: grandTotal equals taxableAmount (tax embedded)', () => {
      const inclusiveConfig = { ...config, pricingMode: 'inclusive' as const };
      const result = calculateTax(input({
        items: [{ productId: 'p1', quantity: 1, unitPrice: 100000 }],
      }), inclusiveConfig);
      expect(result.grandTotal).toBe(100000);
      expect(result.totalTax).toBeGreaterThan(0);
    });
  });
});
