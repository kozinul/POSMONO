import { describe, it, expect } from 'vitest';
import { DiscountEngine } from '../DiscountEngine';
import { IDiscountRule } from '../DiscountRule';

function makeItem(productId: string, categoryId: string, quantity: number, unitPrice: number) {
  return { productId, categoryId, quantity, unitPrice, lineTotal: unitPrice * quantity };
}

describe('DiscountEngine', () => {
  const engine = new DiscountEngine();
  const subtotal = 100000;
  const items = [makeItem('prod_1', 'cat_1', 2, 50000)];

  it('returns zero when no rules', () => {
    const result = engine.applyDiscounts(items, subtotal, []);
    expect(result.totalDiscount).toBe(0);
    expect(result.appliedRules).toHaveLength(0);
  });

  it('applies percentage discount via effects', () => {
    const rules: IDiscountRule[] = [{
      id: 'r1', name: '10% off', priority: 10, stackable: true, active: true,
      scope: { type: 'all', entityId: '', entityName: 'Semua' },
      policy: { type: 'percentage', value: 10, application: 'per_order', roundingMode: 'round', precision: 2 },
      conditions: [],
      effects: [{ type: 'percentage_off', config: { rate: 10 } }],
      currentUsageCount: 0,
    }];

    const result = engine.applyDiscounts(items, subtotal, rules);
    expect(result.totalDiscount).toBe(10000);
    expect(result.appliedRules).toHaveLength(1);
    expect(result.finalSubtotal).toBe(90000);
  });

  it('applies rules in priority order', () => {
    const rules: IDiscountRule[] = [
      { id: 'r2', name: '5% off', priority: 20, stackable: true, active: true,
        scope: { type: 'all', entityId: '', entityName: 'Semua' },
        policy: { type: 'percentage', value: 5, application: 'per_order', roundingMode: 'round', precision: 2 },
        conditions: [],
        effects: [{ type: 'percentage_off', config: { rate: 5 } }],
        currentUsageCount: 0 },
      { id: 'r1', name: '10% off', priority: 10, stackable: true, active: true,
        scope: { type: 'all', entityId: '', entityName: 'Semua' },
        policy: { type: 'percentage', value: 10, application: 'per_order', roundingMode: 'round', precision: 2 },
        conditions: [],
        effects: [{ type: 'percentage_off', config: { rate: 10 } }],
        currentUsageCount: 0 },
    ];

    const result = engine.applyDiscounts(items, subtotal, rules);
    // r1 (10% = 10.000) + r2 (5% of subtotal = 5.000) = 15.000
    expect(result.totalDiscount).toBeCloseTo(15000, 0);
    expect(result.appliedRules).toHaveLength(2);
  });

  it('stops at non-stackable rule', () => {
    const rules: IDiscountRule[] = [
      { id: 'r1', name: '10%', priority: 10, stackable: false, active: true,
        scope: { type: 'all', entityId: '', entityName: 'Semua' },
        policy: { type: 'percentage', value: 10, application: 'per_order', roundingMode: 'round', precision: 2 },
        conditions: [],
        effects: [{ type: 'percentage_off', config: { rate: 10 } }],
        currentUsageCount: 0 },
      { id: 'r2', name: '5%', priority: 20, stackable: true, active: true,
        scope: { type: 'all', entityId: '', entityName: 'Semua' },
        policy: { type: 'percentage', value: 5, application: 'per_order', roundingMode: 'round', precision: 2 },
        conditions: [],
        effects: [{ type: 'percentage_off', config: { rate: 5 } }],
        currentUsageCount: 0 },
    ];

    const result = engine.applyDiscounts(items, subtotal, rules);
    expect(result.totalDiscount).toBe(10000);
    expect(result.appliedRules).toHaveLength(1);
  });

  it('skips rules when conditions not met', () => {
    const rules: IDiscountRule[] = [{
      id: 'r1', name: 'Min 200rb', priority: 10, stackable: true, active: true,
      scope: { type: 'all', entityId: '', entityName: 'Semua' },
      policy: { type: 'percentage', value: 10, application: 'per_order', roundingMode: 'round', precision: 2 },
      conditions: [{ type: 'min_purchase', config: { minAmount: 200000 } }],
      effects: [{ type: 'percentage_off', config: { rate: 10 } }],
      currentUsageCount: 0,
    }];

    const result = engine.applyDiscounts(items, subtotal, rules);
    expect(result.totalDiscount).toBe(0);
    expect(result.appliedRules).toHaveLength(0);
  });

  it('caps total discount at subtotal', () => {
    const rules: IDiscountRule[] = [{
      id: 'r1', name: '200% off', priority: 10, stackable: true, active: true,
      scope: { type: 'all', entityId: '', entityName: 'Semua' },
      policy: { type: 'percentage', value: 200, application: 'per_order', roundingMode: 'round', precision: 2 },
      conditions: [],
      effects: [{ type: 'percentage_off', config: { rate: 200 } }],
      currentUsageCount: 0,
    }];

    const result = engine.applyDiscounts(items, subtotal, rules);
    expect(result.totalDiscount).toBe(subtotal);
    expect(result.finalSubtotal).toBe(0);
  });

  it('handles promo code filtering', () => {
    const rules: IDiscountRule[] = [
      { id: 'r1', name: 'Promo RAMADHAN', priority: 10, stackable: true, active: true,
        scope: { type: 'all', entityId: '', entityName: 'Semua' },
        policy: { type: 'percentage', value: 20, application: 'per_order', roundingMode: 'round', precision: 2 },
        conditions: [],
        effects: [{ type: 'percentage_off', config: { rate: 20 } }],
        promoCodeId: 'promo_ramadhan',
        currentUsageCount: 0 },
      { id: 'r2', name: 'Auto 5%', priority: 20, stackable: true, active: true,
        scope: { type: 'all', entityId: '', entityName: 'Semua' },
        policy: { type: 'percentage', value: 5, application: 'per_order', roundingMode: 'round', precision: 2 },
        conditions: [],
        effects: [{ type: 'percentage_off', config: { rate: 5 } }],
        currentUsageCount: 0 },
    ];

    const withPromo = engine.applyDiscounts(items, subtotal, rules, { promoCode: 'promo_ramadhan' });
    expect(withPromo.appliedRules).toHaveLength(2);
    expect(withPromo.totalDiscount).toBeGreaterThan(10000);

    const withoutPromo = engine.applyDiscounts(items, subtotal, rules, {});
    expect(withoutPromo.appliedRules).toHaveLength(1);
    expect(withoutPromo.totalDiscount).toBe(5000);
  });
});
