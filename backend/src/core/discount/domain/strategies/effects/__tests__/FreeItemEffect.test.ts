import { describe, it, expect } from 'vitest';
import { FreeItemEffect } from '../FreeItemEffect';
import type { IDiscountEffect, EffectContext } from '../EffectStrategy';

describe('FreeItemEffect', () => {
  const sut = new FreeItemEffect();

  it('emits freeItems when product is in cart', () => {
    const ctx: EffectContext = {
      subtotal: 15000,
      items: [{ productId: 'kopi', categoryId: 'minuman', quantity: 1, unitPrice: 15000, lineTotal: 15000 }],
      appliedDiscounts: 0,
    };
    const eff: IDiscountEffect = {
      type: 'free_item',
      config: { productId: 'pisang', quantity: 1 },
    };
    const result = sut.apply(eff, {
      ...ctx,
      items: [
        ...ctx.items,
        { productId: 'pisang', categoryId: 'makanan', quantity: 1, unitPrice: 8000, lineTotal: 8000 },
      ],
    });
    expect(result.freeItems).toBeDefined();
    expect(result.freeItems).toHaveLength(1);
    expect(result.freeItems![0].productId).toBe('pisang');
  });

  it('emits generatedLineItems when product is NOT in cart', () => {
    const ctx: EffectContext = {
      subtotal: 15000,
      items: [{ productId: 'kopi', categoryId: 'minuman', quantity: 1, unitPrice: 15000, lineTotal: 15000 }],
      appliedDiscounts: 0,
    };
    const eff: IDiscountEffect = {
      type: 'free_item',
      config: { productId: 'pisang', productName: 'Pisang Goreng', quantity: 1 },
    };
    const result = sut.apply(eff, ctx);
    expect(result.generatedLineItems).toBeDefined();
    expect(result.generatedLineItems).toHaveLength(1);
    expect(result.generatedLineItems![0].productId).toBe('pisang');
    expect(result.generatedLineItems![0].productName).toBe('Pisang Goreng');
    expect(result.generatedLineItems![0].unitPrice).toBe(0);
  });
});
