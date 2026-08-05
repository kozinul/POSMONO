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

  it('scales free quantity with qualifying items when product is NOT in cart', () => {
    const ctx: EffectContext = {
      subtotal: 30000,
      items: [{ productId: 'kopi', categoryId: 'minuman', quantity: 2, unitPrice: 15000, lineTotal: 30000 }],
      appliedDiscounts: 0,
      conditions: [{ type: 'product_match', config: { productIds: ['kopi'] } }],
    };
    const eff: IDiscountEffect = {
      type: 'free_item',
      config: { productId: 'roti', productName: 'Roti', quantity: 1 },
    };
    const result = sut.apply(eff, ctx);
    expect(result.generatedLineItems![0].quantity).toBe(2);
  });

  it('scales free quantity with qualifying items when product is in cart (surplus emitted as full quantity)', () => {
    const ctx: EffectContext = {
      subtotal: 30000,
      items: [
        { productId: 'kopi', categoryId: 'minuman', quantity: 2, unitPrice: 15000, lineTotal: 30000 },
        { productId: 'roti', categoryId: 'makanan', quantity: 1, unitPrice: 5000, lineTotal: 5000 },
      ],
      appliedDiscounts: 0,
      conditions: [{ type: 'product_match', config: { productIds: ['kopi'] } }],
    };
    const eff: IDiscountEffect = {
      type: 'free_item',
      config: { productId: 'roti', quantity: 1 },
    };
    const result = sut.apply(eff, ctx);
    expect(result.freeItems![0].productId).toBe('roti');
    expect(result.freeItems![0].quantity).toBe(2);
  });

  it('counts only product_match items even when other items exist', () => {
    const ctx: EffectContext = {
      subtotal: 30000,
      items: [
        { productId: 'kopi', categoryId: 'minuman', quantity: 2, unitPrice: 15000, lineTotal: 30000 },
        { productId: 'teh', categoryId: 'minuman', quantity: 5, unitPrice: 7000, lineTotal: 35000 },
      ],
      appliedDiscounts: 0,
      conditions: [{ type: 'product_match', config: { productIds: ['kopi'] } }],
    };
    const eff: IDiscountEffect = {
      type: 'free_item',
      config: { productId: 'roti', productName: 'Roti', quantity: 1 },
    };
    const result = sut.apply(eff, ctx);
    expect(result.generatedLineItems![0].quantity).toBe(2);
  });

  it('respects min_items condition as the qualifying divisor', () => {
    const ctx: EffectContext = {
      subtotal: 30000,
      items: [{ productId: 'kopi', categoryId: 'minuman', quantity: 2, unitPrice: 15000, lineTotal: 30000 }],
      appliedDiscounts: 0,
      conditions: [
        { type: 'product_match', config: { productIds: ['kopi'] } },
        { type: 'min_items', config: { minItems: 2 } },
      ],
    };
    const eff: IDiscountEffect = {
      type: 'free_item',
      config: { productId: 'roti', productName: 'Roti', quantity: 1 },
    };
    const result = sut.apply(eff, ctx);
    expect(result.generatedLineItems![0].quantity).toBe(1);
  });

  it('grants nothing when qualifying sets are zero', () => {
    const ctx: EffectContext = {
      subtotal: 30000,
      items: [{ productId: 'kopi', categoryId: 'minuman', quantity: 2, unitPrice: 15000, lineTotal: 30000 }],
      appliedDiscounts: 0,
      conditions: [
        { type: 'product_match', config: { productIds: ['kopi'] } },
        { type: 'min_items', config: { minItems: 3 } },
      ],
    };
    const eff: IDiscountEffect = {
      type: 'free_item',
      config: { productId: 'roti', productName: 'Roti', quantity: 1 },
    };
    const result = sut.apply(eff, ctx);
    expect(result.freeItems).toBeUndefined();
    expect(result.generatedLineItems).toBeUndefined();
  });
});
