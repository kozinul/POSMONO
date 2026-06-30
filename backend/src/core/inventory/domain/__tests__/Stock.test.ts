import { describe, it, expect } from 'vitest';
import { Stock } from '../Stock';
import { validStockInput } from '../../../../../tests/fixtures/inventory.fixtures';

describe('Stock', () => {
  describe('create', () => {
    it('creates a stock record with given fields', () => {
      const stock = Stock.create(validStockInput);

      const data = stock.serialize();
      expect(data.productId).toBe('product-1');
      expect(data.warehouseId).toBe('wh-1');
      expect(data.quantity).toBe(50);
      expect(data.reservedQuantity).toBe(0);
      expect(data.minLevel).toBe(5);
      expect(data.maxLevel).toBe(100);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('availableQuantity', () => {
    it('returns quantity minus reservedQuantity', () => {
      const stock = Stock.create(validStockInput);

      expect(stock.availableQuantity).toBe(50);
    });

    it('reflects changes after reserve', () => {
      const stock = Stock.create(validStockInput);
      stock.reserve(10);

      expect(stock.availableQuantity).toBe(40);
    });
  });

  describe('reserve', () => {
    it('increases reservedQuantity', () => {
      const stock = Stock.create(validStockInput);
      stock.reserve(10);

      expect(stock.serialize().reservedQuantity).toBe(10);
    });

    it('throws if insufficient available quantity', () => {
      const stock = Stock.create(validStockInput);

      expect(() => stock.reserve(100)).toThrow('Insufficient stock');
    });
  });

  describe('release', () => {
    it('decreases reservedQuantity', () => {
      const stock = Stock.create(validStockInput);
      stock.reserve(20);
      stock.release(10);

      expect(stock.serialize().reservedQuantity).toBe(10);
    });

    it('does not go below zero', () => {
      const stock = Stock.create(validStockInput);
      stock.release(100);

      expect(stock.serialize().reservedQuantity).toBe(0);
    });
  });

  describe('adjust', () => {
    it('increases quantity on positive delta', () => {
      const stock = Stock.create(validStockInput);
      stock.adjust(10, 'Restock');

      expect(stock.serialize().quantity).toBe(60);
    });

    it('decreases quantity on negative delta', () => {
      const stock = Stock.create(validStockInput);
      stock.adjust(-10, 'Sold');

      expect(stock.serialize().quantity).toBe(40);
    });

    it('emits inventory.stock.adjusted event', () => {
      const stock = Stock.create(validStockInput);
      stock.adjust(10, 'Restock');

      const events = stock.domainEvents;
      expect(events.some((e) => e.eventName === 'inventory.stock.adjusted')).toBe(true);
      const adjusted = events.find((e) => e.eventName === 'inventory.stock.adjusted')!;
      expect(adjusted.payload.delta).toBe(10);
      expect(adjusted.payload.reason).toBe('Restock');
    });

    it('emits low_alert when quantity at or below minLevel', () => {
      const stock = Stock.create(validStockInput);
      stock.adjust(-46, 'Sold in bulk');

      const events = stock.domainEvents;
      expect(events.some((e) => e.eventName === 'inventory.stock.low_alert')).toBe(true);
      const alert = events.find((e) => e.eventName === 'inventory.stock.low_alert')!;
      expect(alert.payload.currentStock).toBe(4);
      expect(alert.payload.minLevel).toBe(5);
    });

    it('does not emit low_alert when quantity is above minLevel', () => {
      const stock = Stock.create(validStockInput);
      stock.adjust(-10, 'Sold');

      const events = stock.domainEvents;
      expect(events.some((e) => e.eventName === 'inventory.stock.low_alert')).toBe(false);
    });
  });

  describe('serialize', () => {
    it('returns all stock properties', () => {
      const stock = Stock.create(validStockInput);
      const data = stock.serialize();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('tenantId');
      expect(data).toHaveProperty('productId');
      expect(data).toHaveProperty('warehouseId');
      expect(data).toHaveProperty('quantity');
      expect(data).toHaveProperty('reservedQuantity');
      expect(data).toHaveProperty('minLevel');
      expect(data).toHaveProperty('maxLevel');
      expect(data).toHaveProperty('updatedAt');
    });
  });

  describe('hydrate', () => {
    it('restores stock from persisted data', () => {
      const stock = Stock.create(validStockInput);
      stock.adjust(-10, 'Sold');
      const data = stock.serialize();
      const restored = Stock.hydrate(data);

      expect(restored.serialize()).toEqual(data);
      expect(restored.availableQuantity).toBe(40);
    });
  });
});
