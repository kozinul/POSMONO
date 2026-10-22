import { describe, it, expect } from 'vitest';
import { allocateFreeUnits, sumFreeUnitValue } from '../freeItemAllocation';

describe('allocateFreeUnits', () => {
  it('takes the free unit from the cheapest line of the product', () => {
    const items = [
      { productId: 'kopi', quantity: 1, unitPrice: 25000 },
      { productId: 'kopi', quantity: 1, unitPrice: 15000 },
    ];
    const allocations = allocateFreeUnits(items, new Map([['kopi', 1]]));

    expect(allocations).toHaveLength(1);
    expect(allocations[0].lineIndex).toBe(1);
    expect(allocations[0].unitPrice).toBe(15000);
    expect(allocations[0].value).toBe(15000);
  });

  it('spreads the free units over the cheapest lines first', () => {
    const items = [
      { productId: 'kopi', quantity: 1, unitPrice: 25000 },
      { productId: 'kopi', quantity: 2, unitPrice: 15000 },
    ];
    const allocations = allocateFreeUnits(items, new Map([['kopi', 3]]));

    expect(allocations.map((a) => [a.lineIndex, a.quantity])).toEqual([
      [1, 2],
      [0, 1],
    ]);
    expect(sumFreeUnitValue(allocations)).toBe(55000);
  });

  it('allocates nothing for a product that is not in the cart', () => {
    const items = [{ productId: 'kopi', quantity: 1, unitPrice: 15000 }];
    const allocations = allocateFreeUnits(items, new Map([['roti', 1]]));

    expect(allocations).toEqual([]);
  });

  it('never allocates more units than the cart line holds', () => {
    const items = [{ productId: 'kopi', quantity: 1, unitPrice: 15000 }];
    const allocations = allocateFreeUnits(items, new Map([['kopi', 5]]));

    expect(allocations).toHaveLength(1);
    expect(allocations[0].quantity).toBe(1);
  });
});
