import { describe, it, expect } from 'vitest';
import { FixedPriceEffect } from '../FixedPriceEffect';
import type { IDiscountEffect, EffectContext } from '../EffectStrategy';

describe('FixedPriceEffect', () => {
  const sut = new FixedPriceEffect();

  it('applies fixed price per item matching the rule category', () => {
    const ctx: EffectContext = {
      subtotal: 45000,
      items: [
        { productId: 'kentang', categoryId: 'snack', quantity: 3, unitPrice: 15000, lineTotal: 45000 },
      ],
      appliedDiscounts: 0,
      conditions: [{ type: 'category_match', config: { categoryIds: ['snack'] } }],
    };
    const eff: IDiscountEffect = {
      type: 'fixed_price',
      config: { fixedPrice: 10000 },
    };
    const result = sut.apply(eff, ctx);
    expect(result.discountAmount).toBe(15000);
    expect(result.description).toBe('Harga spesial Rp10.000');
  });

  it('does not apply when rule has no qualifying items', () => {
    const ctx: EffectContext = {
      subtotal: 15000,
      items: [{ productId: 'kopi', categoryId: 'minuman', quantity: 1, unitPrice: 15000, lineTotal: 15000 }],
      appliedDiscounts: 0,
      conditions: [{ type: 'category_match', config: { categoryIds: ['snack'] } }],
    };
    const eff: IDiscountEffect = {
      type: 'fixed_price',
      config: { fixedPrice: 10000 },
    };
    const result = sut.apply(eff, ctx);
    expect(result.discountAmount).toBe(0);
    expect(result.description).toBe('Fixed price (tidak ada item yang cocok)');
  });

  it('matches by productId when provided', () => {
    const ctx: EffectContext = {
      subtotal: 15000,
      items: [{ productId: 'kopi', categoryId: 'minuman', quantity: 1, unitPrice: 15000, lineTotal: 15000 }],
      appliedDiscounts: 0,
    };
    const eff: IDiscountEffect = {
      type: 'fixed_price',
      config: { productId: 'kopi', fixedPrice: 10000 },
    };
    const result = sut.apply(eff, ctx);
    expect(result.discountAmount).toBe(5000);
  });

  it('returns no discount when target product is not in cart', () => {
    const ctx: EffectContext = {
      subtotal: 15000,
      items: [{ productId: 'kopi', categoryId: 'minuman', quantity: 1, unitPrice: 15000, lineTotal: 15000 }],
      appliedDiscounts: 0,
    };
    const eff: IDiscountEffect = {
      type: 'fixed_price',
      config: { productId: 'pisang', fixedPrice: 10000 },
    };
    const result = sut.apply(eff, ctx);
    expect(result.discountAmount).toBe(0);
    expect(result.description).toBe('Fixed price (tidak ada item yang cocok)');
  });
});
