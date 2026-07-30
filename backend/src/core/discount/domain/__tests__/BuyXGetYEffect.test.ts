import { describe, it, expect } from 'vitest';
import { BuyXGetYEffect } from '../strategies/effects/BuyXGetYEffect';
import type { IDiscountEffect, EffectContext } from '../strategies/effects/EffectStrategy';

function makeCtx(overrides?: Partial<EffectContext>): EffectContext {
  return {
    subtotal: 50000,
    items: [
      { productId: 'roti', categoryId: 'makanan', quantity: 3, unitPrice: 5000, lineTotal: 15000 },
      { productId: 'kopi', categoryId: 'minuman', quantity: 2, unitPrice: 10000, lineTotal: 20000 },
      { productId: 'teh', categoryId: 'minuman', quantity: 1, unitPrice: 7000, lineTotal: 7000 },
      { productId: 'snack', categoryId: 'makanan', quantity: 1, unitPrice: 8000, lineTotal: 8000 },
    ],
    appliedDiscounts: 0,
    ...overrides,
  };
}

function effect(config: Record<string, unknown>): IDiscountEffect {
  return { type: 'buy_x_get_y', config };
}

describe('BuyXGetYEffect', () => {
  const sut = new BuyXGetYEffect();

  describe('invalid config', () => {
    it('returns zero when buyQuantity < 1', () => {
      const result = sut.apply(effect({ buyQuantity: 0, getQuantity: 1 }), makeCtx());
      expect(result.discountAmount).toBe(0);
      expect(result.description).toContain('invalid config');
    });

    it('returns zero when getQuantity < 1', () => {
      const result = sut.apply(effect({ buyQuantity: 2, getQuantity: 0 }), makeCtx());
      expect(result.discountAmount).toBe(0);
      expect(result.description).toContain('invalid config');
    });
  });

  describe('insufficient items', () => {
    it('returns zero when total qty < buyQuantity', () => {
      const ctx = makeCtx({ items: [{ productId: 'roti', categoryId: 'makanan', quantity: 1, unitPrice: 5000, lineTotal: 5000 }] });
      const result = sut.apply(effect({ buyQuantity: 3, getQuantity: 1 }), ctx);
      expect(result.discountAmount).toBe(0);
      expect(result.description).toContain('insufficient items');
    });
  });

  describe('target type: cart_item (default)', () => {
    it('picks cheapest free items by default', () => {
      const result = sut.apply(effect({ buyQuantity: 2, getQuantity: 1 }), makeCtx());
      expect(result.discountAmount).toBe(0);
      expect(result.freeItems).toBeDefined();
      expect(result.freeItems).toHaveLength(1);
      expect(result.freeItems![0].productId).toBe('roti');
      expect(result.freeItems![0].quantity).toBe(3);
    });

    it('picks most expensive when specified', () => {
      const result = sut.apply(effect({
        buyQuantity: 2, getQuantity: 1,
        target: { type: 'cart_item', allocationStrategy: 'most_expensive' },
      }), makeCtx());
      expect(result.freeItems).toBeDefined();
      expect(result.freeItems![0].productId).toBe('kopi');
    });

    it('calculates qualifying sets correctly (buy 3 get 2)', () => {
      const ctx = makeCtx({ items: [{ productId: 'roti', categoryId: 'makanan', quantity: 10, unitPrice: 5000, lineTotal: 50000 }] });
      const result = sut.apply(effect({ buyQuantity: 3, getQuantity: 2, target: { type: 'cart_item' } }), ctx);
      expect(result.freeItems).toBeDefined();
      expect(result.freeItems![0].quantity).toBe(6);
    });

    it('uses matchingItems when provided', () => {
      const ctx = makeCtx({
        matchingItems: [
          { productId: 'roti', categoryId: 'makanan', quantity: 2, unitPrice: 5000, lineTotal: 10000 },
        ],
      });
      const result = sut.apply(effect({ buyQuantity: 2, getQuantity: 1 }), ctx);
      expect(result.freeItems).toBeDefined();
      expect(result.freeItems![0].productId).toBe('roti');
    });
  });

  describe('target type: product', () => {
    it('returns generatedLineItem for specific product', () => {
      const ctx = makeCtx();
      const result = sut.apply(effect({
        buyQuantity: 2, getQuantity: 1,
        target: { type: 'product', productId: 'teh', productName: 'Es Teh' },
      }), ctx);
      expect(result.discountAmount).toBe(0);
      expect(result.generatedLineItems).toBeDefined();
      expect(result.generatedLineItems).toHaveLength(1);
      expect(result.generatedLineItems![0].productId).toBe('teh');
      expect(result.generatedLineItems![0].productName).toBe('Es Teh');
      expect(result.generatedLineItems![0].quantity).toBe(3);
      expect(result.generatedLineItems![0].unitPrice).toBe(7000);
    });

    it('picks unitPrice from cart item', () => {
      const ctx = makeCtx({ items: [{ productId: 'teh', categoryId: 'minuman', quantity: 5, unitPrice: 8000, lineTotal: 40000 }] });
      const result = sut.apply(effect({
        buyQuantity: 2, getQuantity: 1,
        target: { type: 'product', productId: 'teh', productName: 'Teh Manis' },
      }), ctx);
      expect(result.generatedLineItems![0].unitPrice).toBe(8000);
    });

    it('returns 0 unitPrice when product not in cart', () => {
      const result = sut.apply(effect({
        buyQuantity: 2, getQuantity: 1,
        target: { type: 'product', productId: 'nonexistent', productName: 'Nope' },
      }), makeCtx());
      expect(result.generatedLineItems![0].unitPrice).toBe(0);
    });
  });

  describe('target type: category', () => {
    it('picks free items from target category (cheapest)', () => {
      const result = sut.apply(effect({
        buyQuantity: 2, getQuantity: 1,
        target: { type: 'category', categoryId: 'minuman', allocationStrategy: 'cheapest' },
      }), makeCtx());
      expect(result.freeItems).toBeDefined();
      expect(result.freeItems![0].productId).toBe('teh');
    });

    it('picks most expensive from category', () => {
      const result = sut.apply(effect({
        buyQuantity: 2, getQuantity: 1,
        target: { type: 'category', categoryId: 'minuman', allocationStrategy: 'most_expensive' },
      }), makeCtx());
      expect(result.freeItems).toBeDefined();
      expect(result.freeItems![0].productId).toBe('kopi');
    });

    it('returns zero when no items in target category', () => {
      const result = sut.apply(effect({
        buyQuantity: 2, getQuantity: 1,
        target: { type: 'category', categoryId: 'nonexistent' },
      }), makeCtx());
      expect(result.discountAmount).toBe(0);
      expect(result.description).toContain('no items in target category');
    });
  });

  describe('target type: same_product', () => {
    it('gives free items of same product (only products with enough qty)', () => {
      const result = sut.apply(effect({
        buyQuantity: 2, getQuantity: 1,
        target: { type: 'same_product' },
      }), makeCtx());
      expect(result.freeItems).toBeDefined();
      expect(result.freeItems).toHaveLength(2);
      expect(result.freeItems![0].productId).toBe('roti');
      expect(result.freeItems![0].quantity).toBe(1);
    });

    it('calculates per-product sets correctly', () => {
      const ctx = makeCtx({ items: [
        { productId: 'roti', categoryId: 'makanan', quantity: 7, unitPrice: 5000, lineTotal: 35000 },
        { productId: 'kopi', categoryId: 'minuman', quantity: 2, unitPrice: 10000, lineTotal: 20000 },
      ] });
      const result = sut.apply(effect({
        buyQuantity: 3, getQuantity: 2,
        target: { type: 'same_product' },
      }), ctx);
      const roti = result.freeItems!.find((f) => f.productId === 'roti');
      const kopi = result.freeItems!.find((f) => f.productId === 'kopi');
      expect(roti!.quantity).toBe(4);
      expect(kopi).toBeUndefined();
    });

    it('returns zero when no product has enough qty', () => {
      const ctx = makeCtx({ items: [
        { productId: 'roti', categoryId: 'makanan', quantity: 1, unitPrice: 5000, lineTotal: 5000 },
        { productId: 'kopi', categoryId: 'minuman', quantity: 1, unitPrice: 10000, lineTotal: 10000 },
      ] });
      const result = sut.apply(effect({
        buyQuantity: 3, getQuantity: 1,
        target: { type: 'same_product' },
      }), ctx);
      expect(result.discountAmount).toBe(0);
      expect(result.description).toContain('insufficient items');
    });
  });
});
