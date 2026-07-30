import { describe, it, expect } from 'vitest';
import { CheapestAllocation } from '../CheapestAllocation';
import { MostExpensiveAllocation } from '../MostExpensiveAllocation';
import { ProportionalAllocation } from '../ProportionalAllocation';
import { allocateDiscount } from '../AllocationApplier';
import type { AllocationItem, AllocationParams } from '../AllocationStrategy';

describe('CheapestAllocation', () => {
  const strategy = new CheapestAllocation();

  it('picks cheapest items from single product', () => {
    const items: AllocationItem[] = [{ productId: 'p1', unitPrice: 5000, quantity: 5 }];
    const params: AllocationParams = { pickCount: 3, qualifiedQty: 5, minQty: 2, freeCount: 1 };
    const result = strategy.allocate(items, params);
    expect(result.selectedItems).toHaveLength(3);
    expect(result.discountAmount).toBe(15000);
  });

  it('picks cheapest across multiple products', () => {
    const items: AllocationItem[] = [
      { productId: 'p1', unitPrice: 5000, quantity: 1 },
      { productId: 'p2', unitPrice: 3000, quantity: 1 },
      { productId: 'p3', unitPrice: 7000, quantity: 1 },
    ];
    const params: AllocationParams = { pickCount: 2, qualifiedQty: 3, minQty: 3, freeCount: 2 };
    const result = strategy.allocate(items, params);
    expect(result.selectedItems).toHaveLength(2);
    expect(result.selectedItems[0].productId).toBe('p2');
    expect(result.selectedItems[1].productId).toBe('p1');
    expect(result.discountAmount).toBe(8000);
  });

  it('handles zero pick count', () => {
    const items: AllocationItem[] = [{ productId: 'p1', unitPrice: 5000, quantity: 3 }];
    const params: AllocationParams = { pickCount: 0, qualifiedQty: 0, minQty: 2, freeCount: 0 };
    const result = strategy.allocate(items, params);
    expect(result.selectedItems).toHaveLength(0);
    expect(result.discountAmount).toBe(0);
  });
});

describe('MostExpensiveAllocation', () => {
  const strategy = new MostExpensiveAllocation();

  it('picks most expensive items', () => {
    const items: AllocationItem[] = [
      { productId: 'p1', unitPrice: 5000, quantity: 1 },
      { productId: 'p2', unitPrice: 3000, quantity: 1 },
      { productId: 'p3', unitPrice: 7000, quantity: 1 },
    ];
    const params: AllocationParams = { pickCount: 2, qualifiedQty: 3, minQty: 3, freeCount: 2 };
    const result = strategy.allocate(items, params);
    expect(result.selectedItems).toHaveLength(2);
    expect(result.selectedItems[0].productId).toBe('p3');
    expect(result.selectedItems[1].productId).toBe('p1');
    expect(result.discountAmount).toBe(12000);
  });

  it('handles same price correctly', () => {
    const items: AllocationItem[] = [
      { productId: 'p1', unitPrice: 5000, quantity: 2 },
      { productId: 'p2', unitPrice: 5000, quantity: 1 },
    ];
    const params: AllocationParams = { pickCount: 2, qualifiedQty: 3, minQty: 3, freeCount: 2 };
    const result = strategy.allocate(items, params);
    expect(result.selectedItems).toHaveLength(2);
    expect(result.discountAmount).toBe(10000);
  });
});

describe('ProportionalAllocation', () => {
  const strategy = new ProportionalAllocation();

  it('allocates proportionally across items sorted by productId', () => {
    const items: AllocationItem[] = [
      { productId: 'p_a', unitPrice: 3000, quantity: 1 },
      { productId: 'p_m', unitPrice: 5000, quantity: 1 },
      { productId: 'p_z', unitPrice: 7000, quantity: 1 },
    ];
    const params: AllocationParams = { pickCount: 2, qualifiedQty: 3, minQty: 3, freeCount: 2 };
    const result = strategy.allocate(items, params);
    expect(result.selectedItems).toHaveLength(3);
    expect(result.discountAmount).toBe((3000 + 5000 + 7000) * 2 / 3);
  });

  it('handles single item with multiple quantity', () => {
    const items: AllocationItem[] = [{ productId: 'p1', unitPrice: 5000, quantity: 5 }];
    const params: AllocationParams = { pickCount: 2, qualifiedQty: 4, minQty: 2, freeCount: 1 };
    const result = strategy.allocate(items, params);
    expect(result.selectedItems).toHaveLength(4);
  });
});

describe('allocateDiscount applier', () => {
  it('routes to correct strategy', () => {
    const items: AllocationItem[] = [{ productId: 'p1', unitPrice: 5000, quantity: 2 }];
    const params: AllocationParams = { pickCount: 1, qualifiedQty: 2, minQty: 2, freeCount: 1 };

    const cheapest = allocateDiscount('cheapest', items, params);
    expect(cheapest.discountAmount).toBe(5000);

    const expensive = allocateDiscount('most_expensive', items, params);
    expect(expensive.discountAmount).toBe(5000);
  });

  it('returns empty for unknown type', () => {
    const result = allocateDiscount('unknown' as any, [], { pickCount: 1, qualifiedQty: 0, minQty: 0, freeCount: 0 });
    expect(result.discountAmount).toBe(0);
    expect(result.selectedItems).toEqual([]);
  });

  it('returns empty for empty items', () => {
    const result = allocateDiscount('cheapest', [], { pickCount: 1, qualifiedQty: 0, minQty: 0, freeCount: 0 });
    expect(result.discountAmount).toBe(0);
    expect(result.selectedItems).toEqual([]);
  });
});
