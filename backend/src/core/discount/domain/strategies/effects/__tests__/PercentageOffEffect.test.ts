import { describe, it, expect } from 'vitest';
import { PercentageOffEffect } from '../PercentageOffEffect';
import type { IDiscountEffect, EffectContext } from '../EffectStrategy';

describe('PercentageOffEffect', () => {
  const sut = new PercentageOffEffect();

  const cart: EffectContext = {
    subtotal: 70000,
    items: [
      { productId: 'kopi', categoryId: 'minuman', quantity: 3, unitPrice: 15000, lineTotal: 45000 },
      { productId: 'teh', categoryId: 'minuman', quantity: 1, unitPrice: 25000, lineTotal: 25000 },
    ],
    appliedDiscounts: 0,
    matchingSubtotal: 70000,
  };

  it('discounts the whole scope for the order target', () => {
    const eff: IDiscountEffect = { type: 'percentage_off', config: { rate: 10, target: 'order' } };
    expect(sut.apply(eff, cart).discountAmount).toBe(7000);
  });

  it('discounts the scope for the item target', () => {
    const eff: IDiscountEffect = { type: 'percentage_off', config: { rate: 10, target: 'item' } };
    expect(sut.apply(eff, { ...cart, matchingSubtotal: 45000 }).discountAmount).toBe(4500);
  });

  it('discounts the remaining amount for the remaining target', () => {
    const eff: IDiscountEffect = { type: 'percentage_off', config: { rate: 10, target: 'remaining' } };
    expect(sut.apply(eff, { ...cart, appliedDiscounts: 20000 }).discountAmount).toBe(5000);
  });

  it('discounts only the cheapest line for the cheapest_item target', () => {
    const eff: IDiscountEffect = { type: 'percentage_off', config: { rate: 10, target: 'cheapest_item' } };
    // The cheapest line is 3 × 15.000 = 45.000 — the order total is 70.000.
    expect(sut.apply(eff, cart).discountAmount).toBe(4500);
  });

  it('resolves the cheapest line inside the promotion scope', () => {
    const eff: IDiscountEffect = { type: 'percentage_off', config: { rate: 10, target: 'cheapest_item' } };
    const result = sut.apply(eff, {
      ...cart,
      conditions: [{ type: 'product_match', config: { productIds: ['teh'] } }],
    });
    expect(result.discountAmount).toBe(2500);
  });

  it('never exceeds the maximum discount', () => {
    const eff: IDiscountEffect = {
      type: 'percentage_off',
      config: { rate: 10, target: 'order', maxCap: 3000 },
    };
    expect(sut.apply(eff, cart).discountAmount).toBe(3000);
  });
});
