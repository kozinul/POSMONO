import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoStockRepository } from '../../src/core/inventory/infrastructure/persistence/MongoStockRepository';
import { StockSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/StockSchema';
import { Stock } from '../../src/core/inventory/domain/Stock';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

let model: Model<any>;
let repo: MongoStockRepository;

function createStock(tenantId: string, overrides: Record<string, unknown> = {}) {
  return Stock.create({
    tenantId,
    productId: 'product-1',
    variantId: null,
    warehouseId: 'wh-1',
    quantity: 50,
    reservedQuantity: 0,
    minLevel: 5,
    maxLevel: 100,
    ...overrides,
  });
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('StockItem', StockSchema);
  repo = new MongoStockRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoStockRepository', () => {
  describe('save + findByProduct', () => {
    it('saves and retrieves stock by product', async () => {
      const stock = createStock(TENANT_A);
      await repo.save(stock);

      const found = await repo.findByProduct(TENANT_A, 'product-1');
      expect(found).not.toBeNull();
      expect(found!.serialize().quantity).toBe(50);
      expect(found!.serialize().tenantId).toBe(TENANT_A);
    });

    it('returns null for non-existent stock', async () => {
      const found = await repo.findByProduct(TENANT_A, 'nonexistent');
      expect(found).toBeNull();
    });

    it('updates existing stock on second save', async () => {
      const stock = createStock(TENANT_A);
      await repo.save(stock);

      stock.adjust(10, 'restock');
      await repo.save(stock);

      const found = await repo.findByProduct(TENANT_A, 'product-1');
      expect(found!.serialize().quantity).toBe(60);
    });

    it('isolates stock by tenant', async () => {
      await repo.save(createStock(TENANT_A, { productId: 'p1' }));

      const found = await repo.findByProduct(TENANT_B, 'p1');
      expect(found).toBeNull();
    });
  });

  describe('findByTenant', () => {
    it('returns all stock for a tenant', async () => {
      await repo.save(createStock(TENANT_A, { productId: 'p1' }));
      await repo.save(createStock(TENANT_A, { productId: 'p2' }));
      await repo.save(createStock(TENANT_B, { productId: 'p3' }));

      const stocks = await repo.findByTenant(TENANT_A);
      expect(stocks).toHaveLength(2);
    });

    it('returns empty array for tenant with no stock', async () => {
      const stocks = await repo.findByTenant(TENANT_A);
      expect(stocks).toHaveLength(0);
    });
  });

  describe('findLowStock', () => {
    it('returns only stock where quantity <= minLevel', async () => {
      await repo.save(createStock(TENANT_A, { productId: 'p1', quantity: 50, minLevel: 10 }));
      await repo.save(createStock(TENANT_A, { productId: 'p2', quantity: 3, minLevel: 5 }));
      await repo.save(createStock(TENANT_A, { productId: 'p3', quantity: 5, minLevel: 5 }));

      const lowStock = await repo.findLowStock(TENANT_A);
      expect(lowStock).toHaveLength(2);
      expect(lowStock.map((s) => s.serialize().productId).sort()).toEqual(['p2', 'p3']);
    });

    it('isolates low stock by tenant', async () => {
      await repo.save(createStock(TENANT_A, { productId: 'p1', quantity: 2, minLevel: 5 }));
      await repo.save(createStock(TENANT_B, { productId: 'p2', quantity: 50, minLevel: 5 }));

      const lowStock = await repo.findLowStock(TENANT_B);
      expect(lowStock).toHaveLength(0);
    });

    it('returns empty when no stock is low', async () => {
      await repo.save(createStock(TENANT_A, { productId: 'p1', quantity: 50, minLevel: 5 }));

      const lowStock = await repo.findLowStock(TENANT_A);
      expect(lowStock).toHaveLength(0);
    });
  });
});
