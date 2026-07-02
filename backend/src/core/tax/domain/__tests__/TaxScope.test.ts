import { describe, it, expect } from 'vitest';
import { TaxScope } from '../TaxScope';

describe('TaxScope', () => {
  describe('all', () => {
    it('applies to any context', () => {
      const scope = TaxScope.all();
      expect(scope.appliesTo({})).toBe(true);
      expect(scope.appliesTo({ items: [], outletId: 'x' })).toBe(true);
    });

    it('serializes with type all', () => {
      expect(TaxScope.all().serialize()).toEqual({ type: 'all', entityId: '', entityName: 'Semua' });
    });
  });

  describe('category', () => {
    it('matches when item has same categoryId', () => {
      const scope = TaxScope.forCategory('cat-1', 'Makanan');
      expect(scope.appliesTo({ items: [{ productId: 'p1', categoryId: 'cat-1' }] })).toBe(true);
    });

    it('does not match when no item matches category', () => {
      const scope = TaxScope.forCategory('cat-1', 'Makanan');
      expect(scope.appliesTo({ items: [{ productId: 'p1', categoryId: 'cat-2' }] })).toBe(false);
    });

    it('returns false when items are empty', () => {
      const scope = TaxScope.forCategory('cat-1', 'Makanan');
      expect(scope.appliesTo({ items: [] })).toBe(false);
    });

    it('returns false when items undefined', () => {
      const scope = TaxScope.forCategory('cat-1', 'Makanan');
      expect(scope.appliesTo({})).toBe(false);
    });
  });

  describe('product', () => {
    it('matches when item has same productId', () => {
      const scope = TaxScope.forProduct('p-1', 'Nasi Goreng');
      expect(scope.appliesTo({ items: [{ productId: 'p-1', categoryId: 'c-1' }] })).toBe(true);
    });

    it('does not match different productId', () => {
      const scope = TaxScope.forProduct('p-1', 'Nasi Goreng');
      expect(scope.appliesTo({ items: [{ productId: 'p-2', categoryId: 'c-1' }] })).toBe(false);
    });
  });

  describe('outlet', () => {
    it('matches when outletId equals context outletId', () => {
      const scope = TaxScope.forOutlet('outlet-1', 'Gerai Utama');
      expect(scope.appliesTo({ outletId: 'outlet-1' })).toBe(true);
    });

    it('does not match different outletId', () => {
      const scope = TaxScope.forOutlet('outlet-1', 'Gerai Utama');
      expect(scope.appliesTo({ outletId: 'outlet-2' })).toBe(false);
    });
  });

  describe('transaction_type', () => {
    it('matches when transactionType matches', () => {
      const scope = TaxScope.forTransactionType('dine_in', 'Makan di Tempat');
      expect(scope.appliesTo({ transactionType: 'dine_in' })).toBe(true);
    });

    it('does not match different type', () => {
      const scope = TaxScope.forTransactionType('dine_in', 'Makan di Tempat');
      expect(scope.appliesTo({ transactionType: 'takeaway' })).toBe(false);
    });
  });

  describe('customer', () => {
    it('matches when customerTags include entityId', () => {
      const scope = TaxScope.create({ type: 'customer', entityId: 'vip', entityName: 'VIP' });
      expect(scope.appliesTo({ customerTags: ['vip', 'member'] })).toBe(true);
    });

    it('does not match when tag absent', () => {
      const scope = TaxScope.create({ type: 'customer', entityId: 'vip', entityName: 'VIP' });
      expect(scope.appliesTo({ customerTags: ['regular'] })).toBe(false);
    });
  });

  describe('service_type', () => {
    it('matches when customerTags include entityId', () => {
      const scope = TaxScope.create({ type: 'service_type', entityId: 'delivery', entityName: 'Delivery' });
      expect(scope.appliesTo({ customerTags: ['delivery'] })).toBe(true);
    });
  });

  describe('unknown type', () => {
    it('returns false', () => {
      const scope = TaxScope.create({ type: 'unknown' as any, entityId: '', entityName: '' });
      expect(scope.appliesTo({})).toBe(false);
    });
  });

  describe('getType', () => {
    it('returns the scope type', () => {
      expect(TaxScope.all().getType()).toBe('all');
      expect(TaxScope.forCategory('c1', 'Minuman').getType()).toBe('category');
    });
  });
});
