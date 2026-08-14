import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '../../src/core/inventory/application/services/InventoryService';
import { Stock } from '../../src/core/inventory/domain/Stock';
import { StockMovement } from '../../src/core/inventory/domain/StockMovement';
import { NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';

function createMockStockRepo() {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByProduct: vi.fn(),
    findByTenant: vi.fn(),
    findLowStock: vi.fn(),
    findByWarehouse: vi.fn(),
    deleteByProduct: vi.fn(),
  };
}

function createMockMovementRepo() {
  return {
    save: vi.fn(),
    findByTenant: vi.fn(),
  };
}

function createMockWarehouseRepo() {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByTenant: vi.fn(),
    findActiveByTenant: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockEventBus() {
  return { publish: vi.fn() };
}

describe('InventoryService', () => {
  let stockRepo: ReturnType<typeof createMockStockRepo>;
  let movementRepo: ReturnType<typeof createMockMovementRepo>;
  let warehouseRepo: ReturnType<typeof createMockWarehouseRepo>;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let service: InventoryService;

  beforeEach(() => {
    stockRepo = createMockStockRepo();
    movementRepo = createMockMovementRepo();
    warehouseRepo = createMockWarehouseRepo();
    eventBus = createMockEventBus();
    service = new InventoryService(stockRepo, movementRepo, warehouseRepo, eventBus);
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
      warehouseRepo.findActiveByTenant.mockResolvedValue([]);

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
      warehouseRepo.findActiveByTenant.mockResolvedValue([]);

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

    it('uses first active warehouse when no warehouseId provided', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);
      warehouseRepo.findActiveByTenant.mockResolvedValue([
        { id: { toValue: () => 'wh-active' }, serialize: () => ({ id: 'wh-active' }) },
      ]);

      await service.stockIn({ tenantId: TENANT_ID, productId: 'p1', quantity: 10 });

      const savedStock = stockRepo.save.mock.calls[0][0];
      expect(savedStock.serialize().warehouseId).toBe('wh-active');
    });

    it('publishes domain events', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);
      warehouseRepo.findActiveByTenant.mockResolvedValue([]);

      await service.stockIn({ tenantId: TENANT_ID, productId: 'p1', quantity: 10 });

      expect(eventBus.publish).toHaveBeenCalled();
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
      warehouseRepo.findActiveByTenant.mockResolvedValue([]);

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
      warehouseRepo.findActiveByTenant.mockResolvedValue([]);

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
      warehouseRepo.findActiveByTenant.mockResolvedValue([]);

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

  describe('reserveStock', () => {
    it('reserves available stock', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 50, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      await service.reserveStock({ tenantId: TENANT_ID, productId: 'p1', quantity: 10 });

      const savedStock = stockRepo.save.mock.calls[0][0] as Stock;
      expect(savedStock.serialize().reservedQuantity).toBe(10);
      expect(movementRepo.save).toHaveBeenCalledTimes(1);
    });

    it('throws ValidationError when insufficient available stock', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 50, reservedQuantity: 45, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      await expect(service.reserveStock({ tenantId: TENANT_ID, productId: 'p1', quantity: 10 }))
        .rejects.toThrow(ValidationError);
    });

    it('silently returns when stock not found', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);

      await service.reserveStock({ tenantId: TENANT_ID, productId: 'p1', quantity: 5 });

      expect(stockRepo.save).not.toHaveBeenCalled();
    });

    it('silently returns when quantity is zero', async () => {
      await service.reserveStock({ tenantId: TENANT_ID, productId: 'p1', quantity: 0 });

      expect(stockRepo.findByProduct).not.toHaveBeenCalled();
    });
  });

  describe('releaseStock', () => {
    it('releases reserved stock', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 50, reservedQuantity: 10, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      await service.releaseStock({ tenantId: TENANT_ID, productId: 'p1', quantity: 5 });

      const savedStock = stockRepo.save.mock.calls[0][0] as Stock;
      expect(savedStock.serialize().reservedQuantity).toBe(5);
      expect(movementRepo.save).toHaveBeenCalledTimes(1);
    });

    it('silently returns when stock not found', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);

      await service.releaseStock({ tenantId: TENANT_ID, productId: 'p1', quantity: 5 });

      expect(stockRepo.save).not.toHaveBeenCalled();
    });

    it('clamps reservedQuantity to zero', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 50, reservedQuantity: 3, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      await service.releaseStock({ tenantId: TENANT_ID, productId: 'p1', quantity: 10 });

      const savedStock = stockRepo.save.mock.calls[0][0] as Stock;
      expect(savedStock.serialize().reservedQuantity).toBe(0);
    });
  });

  describe('decrementForSale', () => {
    it('decrements stock for tracked products', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 50, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      await service.decrementForSale({ tenantId: TENANT_ID, productId: 'p1', quantity: 5 });

      expect(stockRepo.save).toHaveBeenCalled();
    });

    it('skips untracked products (quantity 0)', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 0, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      await service.decrementForSale({ tenantId: TENANT_ID, productId: 'p1', quantity: 5 });

      expect(stockRepo.save).not.toHaveBeenCalled();
    });

    it('silently returns when stock not found', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);

      await service.decrementForSale({ tenantId: TENANT_ID, productId: 'p1', quantity: 5 });

      expect(stockRepo.save).not.toHaveBeenCalled();
    });

    it('throws ValidationError when insufficient stock', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 3, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      await expect(service.decrementForSale({ tenantId: TENANT_ID, productId: 'p1', quantity: 5 }))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('incrementForReturn', () => {
    it('increments stock for returns', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);
      warehouseRepo.findActiveByTenant.mockResolvedValue([]);

      await service.incrementForReturn({ tenantId: TENANT_ID, productId: 'p1', quantity: 3 });

      expect(stockRepo.save).toHaveBeenCalled();
      expect(movementRepo.save).toHaveBeenCalled();
    });

    it('silently returns when quantity is zero', async () => {
      await service.incrementForReturn({ tenantId: TENANT_ID, productId: 'p1', quantity: 0 });

      expect(stockRepo.findByProduct).not.toHaveBeenCalled();
    });
  });

  describe('restockForVoid', () => {
    it('restores stock and creates a void movement', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 47, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      await service.restockForVoid({
        tenantId: TENANT_ID,
        productId: 'p1',
        quantity: 3,
        referenceId: 'order-1',
        orderNumber: 'ORD-0001',
        reason: 'Salah input',
        userId: 'u1',
      });

      const savedStock = stockRepo.save.mock.calls[0][0] as Stock;
      expect(savedStock.serialize().quantity).toBe(50);

      const movement = movementRepo.save.mock.calls[0][0] as StockMovement;
      const data = movement.serialize();
      expect(data.type).toBe('void');
      expect(data.quantity).toBe(3);
      expect(data.beforeQuantity).toBe(47);
      expect(data.afterQuantity).toBe(50);
      expect(data.referenceType).toBe('void');
      expect(data.referenceId).toBe('order-1');
      expect(data.notes).toBe('Void #ORD-0001 - Salah input');
      expect(data.userId).toBe('u1');
    });

    it('silently returns when stock not found', async () => {
      stockRepo.findByProduct.mockResolvedValue(null);

      await service.restockForVoid({ tenantId: TENANT_ID, productId: 'p1', quantity: 3 });

      expect(stockRepo.save).not.toHaveBeenCalled();
      expect(movementRepo.save).not.toHaveBeenCalled();
    });

    it('silently returns when quantity is zero', async () => {
      await service.restockForVoid({ tenantId: TENANT_ID, productId: 'p1', quantity: 0 });

      expect(stockRepo.findByProduct).not.toHaveBeenCalled();
    });

    it('formats notes without reason', async () => {
      const existing = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 10, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(existing);

      await service.restockForVoid({ tenantId: TENANT_ID, productId: 'p1', quantity: 1 });

      const movement = movementRepo.save.mock.calls[0][0] as StockMovement;
      expect(movement.serialize().notes).toBe('Void transaksi');
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

  describe('exportStock', () => {
    it('returns stock data for export', async () => {
      const stock = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 50, reservedQuantity: 5, minLevel: 5, maxLevel: 100 });
      stockRepo.findByTenant.mockResolvedValue([stock]);

      const result = await service.exportStock(TENANT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('p1');
      expect(result[0].quantity).toBe(50);
      expect(result[0].reservedQuantity).toBe(5);
    });
  });

  describe('importStock', () => {
    it('imports stock items successfully', async () => {
      const stock = Stock.create({ tenantId: TENANT_ID, productId: 'p1', variantId: null, warehouseId: 'wh-1', quantity: 0, reservedQuantity: 0, minLevel: 5, maxLevel: 100 });
      stockRepo.findByProduct.mockResolvedValue(null);
      warehouseRepo.findActiveByTenant.mockResolvedValue([]);

      const result = await service.importStock(TENANT_ID, [
        { productId: 'p1', quantity: 50 },
      ]);

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('reports errors for failed imports', async () => {
      stockRepo.findByProduct.mockRejectedValue(new Error('DB error'));

      const result = await service.importStock(TENANT_ID, [
        { productId: 'p1', quantity: 50 },
      ]);

      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
    });
  });
});
