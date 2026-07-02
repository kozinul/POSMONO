import { describe, it, expect } from 'vitest';
import { DiscountScope } from '../DiscountScope';

describe('DiscountScope', () => {
  it('all matches everything', () => {
    const scope = DiscountScope.all();
    expect(scope.matches({})).toBe(true);
  });

  it('category matches correctly', () => {
    const scope = DiscountScope.forCategory('cat_1', 'Makanan');
    expect(scope.matches({ categoryId: 'cat_1' })).toBe(true);
    expect(scope.matches({ categoryId: 'cat_2' })).toBe(false);
  });

  it('product matches correctly', () => {
    const scope = DiscountScope.forProduct('prod_1', 'Kopi');
    expect(scope.matches({ productId: 'prod_1' })).toBe(true);
    expect(scope.matches({ productId: 'prod_2' })).toBe(false);
  });

  it('serializes correctly', () => {
    const scope = DiscountScope.forProduct('p1', 'Teh');
    expect(scope.serialize()).toEqual({ type: 'product', entityId: 'p1', entityName: 'Teh' });
  });
});
