import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '../../src/core/inventory/application/services/InventoryService';
import { Stock } from '../../src/core/inventory/domain/Stock';
import { StockMovement } from '../../src/core/inventory/domain/StockMovement';
import { NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';

function createMockStockRepo() {
  return { save: vi.fn(), findById: vi.fn(), findByProduct: vi.fn(), findByTenant: vi.fn(), findLowStock: vi.fn() };
}

function createMockMovementRepo() {
  return { save: vi.fn(), findByTenant: vi.fn() };
}

describe('InventoryService', () => {
  let stockRepo: ReturnType<typeof createMockStockRepo>;
  let movementRepo: ReturnType<typeof createMockMovementRepo>;
  let service: InventoryService;

  beforeEach(() => {
    stockRepo = createMockStockRepo();
    movementRepo = createMockMovementRepo();
    service = new InventoryService(stockRepo, movementRepo);
  });

  describe('getStock', () => {
    it('returns stock for a product', async () => {
      const stock = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 50, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(stock);

      const result = await service.getStock(TENANT_ID, 'p1');
      expect(result.serialize().quantity).toBe(50);
    });

    it('throws NotFoundError when stock does not exist', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);

      await expect(service.getStock(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listStock', () => {
    it('returns all stock for tenant', async () => {
      stockRepo.findByTenant.mockResolvedValue([{ serialize: () => ({ productId: 'p1' }) }]);

      const result = await service.listStock(TENANT_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe('getLowStock', () => {
    it('returns low stock items', async () => {
      stockRepo.findLowStock.mockResolvedValue([{ serialize: () => ({ productId: 'p1', quantity: 2 }) }]);

      const result = await service.getLowStock(TENANT_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe('stockIn', () => {
    it('adds stock and creates movement', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);

      const stock = await service.stockIn({
        tenantId: TENANT_ID,
        productId: 'p1',
        quantity: 50,
      });

      const data = stock.serialize();
      expect(data.quantity).toBe(50);
      expect(stockRepo.save).toHaveBeenCalledTimes(1);
      expect(movementRepo.save).toHaveBeenCalledTimes(1);
    });

    it('increases existing stock quantity', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 30, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      const stock = await service.stockIn({
        tenantId: TENANT_ID,
        productId: 'p1',
        quantity: 20,
      });

      expect(stock.serialize().quantity).toBe(50);
    });

    it('throws ValidationError when quantity is zero or negative', async () => {
      await expect(service.stockIn({ tenantId: TENANT_ID, productId: 'p1', quantity: 0 }))
        .rejects.toThrow(ValidationError);
      await expect(service.stockIn({ tenantId: TENANT_ID, productId: 'p1', quantity: -5 }))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('stockOut', () => {
    it('reduces stock and creates movement', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 50, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      const stock = await service.stockOut({
        tenantId: TENANT_ID,
        productId: 'p1',
        quantity: 20,
      });

      expect(stock.serialize().quantity).toBe(30);
      expect(stockRepo.save).toHaveBeenCalledTimes(1);
      expect(movementRepo.save).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError when stock does not exist', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);

      await expect(service.stockOut({ tenantId: TENANT_ID, productId: 'p1', quantity: 10 }))
        .rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when quantity exceeds available', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 5, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      await expect(service.stockOut({ tenantId: TENANT_ID, productId: 'p1', quantity: 10 }))
        .rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when quantity is zero or negative', async () => {
      await expect(service.stockOut({ tenantId: TENANT_ID, productId: 'p1', quantity: 0 }))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('adjust', () => {
    it('adjusts stock quantity with positive delta', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 50, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      const stock = await service.adjust({
        tenantId: TENANT_ID,
        productId: 'p1',
        delta: 10,
        reason: 'restock',
      });

      expect(stock.serialize().quantity).toBe(60);
    });

    it('adjusts stock quantity with negative delta', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 50, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      const stock = await service.adjust({
        tenantId: TENANT_ID,
        productId: 'p1',
        delta: -10,
        reason: 'damage',
      });

      expect(stock.serialize().quantity).toBe(40);
    });

    it('creates stock record if not exists', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);

      const stock = await service.adjust({
        tenantId: TENANT_ID,
        productId: 'p1',
        delta: 25,
        reason: 'initial',
      });

      expect(stock.serialize().quantity).toBe(25);
      expect(stockRepo.save).toHaveBeenCalledTimes(1);
      expect(movementRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMovements', () => {
    it('returns movements with pagination', async () => {
      const movement = StockMovement.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', type: 'in', quantity: 10, beforeQuantity: 0, afterQuantity: 10, referenceType: 'stock_in', referenceId: '', notes: '', userId: '' });
      movementRepo.findByTenant.mockResolvedValue({ movements: [movement], total: 1 });

      const result = await service.getMovements(TENANT_ID);
      expect(result.movements).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('filters movements by product and type', async () => {
      movementRepo.findByTenant.mockResolvedValue({ movements: [], total: 0 });

      await service.getMovements(TENANT_ID, { productId: 'p1', type: 'in' });

      expect(movementRepo.findByTenant).toHaveBeenCalledWith(
        TENANT_ID,
        { productId: 'p1', type: 'in' },
        1,
        50,
      );
    });
  });
});
