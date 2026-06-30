import { describe, it, expect } from 'vitest';
import { StockMovement } from '../StockMovement';
import { validStockMovementInput } from '../../../../../tests/fixtures/inventory.fixtures';

describe('StockMovement', () => {
  describe('create', () => {
    it('creates a stock movement with given fields', () => {
      const movement = StockMovement.create(validStockMovementInput);

      const data = movement.serialize();
      expect(data.productId).toBe('product-1');
      expect(data.type).toBe('in');
      expect(data.quantity).toBe(10);
      expect(data.beforeQuantity).toBe(40);
      expect(data.afterQuantity).toBe(50);
      expect(data.referenceType).toBe('purchase_order');
      expect(data.userId).toBe('user-1');
      expect(data.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('immutability', () => {
    it('has no state-changing methods', () => {
      const movement = StockMovement.create(validStockMovementInput);
      const methods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(movement),
      ).filter((m) => m !== 'constructor' && m !== 'serialize');

      expect(methods).toEqual([]);
    });
  });

  describe('serialize', () => {
    it('returns all stock movement properties', () => {
      const movement = StockMovement.create(validStockMovementInput);
      const data = movement.serialize();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('tenantId');
      expect(data).toHaveProperty('productId');
      expect(data).toHaveProperty('warehouseId');
      expect(data).toHaveProperty('type');
      expect(data).toHaveProperty('quantity');
      expect(data).toHaveProperty('beforeQuantity');
      expect(data).toHaveProperty('afterQuantity');
      expect(data).toHaveProperty('referenceType');
      expect(data).toHaveProperty('referenceId');
      expect(data).toHaveProperty('notes');
      expect(data).toHaveProperty('userId');
      expect(data).toHaveProperty('createdAt');
    });
  });

  describe('hydrate', () => {
    it('restores a stock movement from persisted data', () => {
      const movement = StockMovement.create(validStockMovementInput);
      const data = movement.serialize();
      const restored = StockMovement.hydrate(data);

      expect(restored.serialize()).toEqual(data);
    });
  });
});
