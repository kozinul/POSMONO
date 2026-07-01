import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoProductRepository } from '../../src/core/catalog/infrastructure/persistence/MongoProductRepository';
import { ProductSchema } from '../../src/core/catalog/infrastructure/persistence/schemas/ProductSchema';
import { Product } from '../../src/core/catalog/domain/Product';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

let model: Model<any>;
let repo: MongoProductRepository;

function createProduct(tenantId: string, overrides: Record<string, unknown> = {}) {
  return Product.create({
    tenantId,
    sku: 'SKU-TEST',
    barcode: '',
    name: 'Test Product',
    description: '',
    categoryId: 'cat-1',
    basePrice: 10000,
    imageUrls: [],
    tags: [],
    isActive: true,
    metadata: {},
    ...overrides,
  } as any);
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('Product', ProductSchema);
  repo = new MongoProductRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoProductRepository', () => {
  describe('save + findById', () => {
    it('saves and retrieves a product', async () => {
      const product = createProduct(TENANT_A);
      await repo.save(product);

      const found = await repo.findById(product.id.toValue());
      expect(found).not.toBeNull();
      expect(found!.serialize().name).toBe('Test Product');
      expect(found!.serialize().tenantId).toBe(TENANT_A);
    });

    it('returns null for non-existent product', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });

    it('updates existing product on second save', async () => {
      const product = createProduct(TENANT_A);
      await repo.save(product);

      product.update({ name: 'Updated Name', basePrice: 25000 });
      await repo.save(product);

      const found = await repo.findById(product.id.toValue());
      expect(found!.serialize().name).toBe('Updated Name');
      expect(found!.serialize().basePrice).toBe(25000);
    });
  });

  describe('findBySku', () => {
    it('finds product by SKU within tenant', async () => {
      const product = createProduct(TENANT_A, { sku: 'SKU-UNIQUE' });
      await repo.save(product);

      const found = await repo.findBySku(TENANT_A, 'SKU-UNIQUE');
      expect(found).not.toBeNull();
      expect(found!.serialize().sku).toBe('SKU-UNIQUE');
    });

    it('returns null when SKU not found', async () => {
      const found = await repo.findBySku(TENANT_A, 'NONEXISTENT');
      expect(found).toBeNull();
    });

    it('does not return product from different tenant with same SKU', async () => {
      await repo.save(createProduct(TENANT_A, { sku: 'SHARED-SKU' }));

      const found = await repo.findBySku(TENANT_B, 'SHARED-SKU');
      expect(found).toBeNull();
    });

    it('SKU is unique within tenant', async () => {
      await repo.save(createProduct(TENANT_A, { sku: 'DUP-SKU' }));

      const duplicate = createProduct(TENANT_A, { sku: 'DUP-SKU' });
      await expect(repo.save(duplicate)).rejects.toThrow();
    });
  });

  describe('findByTenant', () => {
    it('returns products for a specific tenant only', async () => {
      await repo.save(createProduct(TENANT_A, { name: 'Product A' }));
      await repo.save(createProduct(TENANT_B, { name: 'Product B' }));

      const result = await repo.findByTenant(TENANT_A);
      expect(result.products).toHaveLength(1);
      expect(result.products[0].serialize().name).toBe('Product A');
    });

    it('filters by categoryId', async () => {
      await repo.save(createProduct(TENANT_A, { sku: 'SKU-FOOD', categoryId: 'cat-food', name: 'Food' }));
      await repo.save(createProduct(TENANT_A, { sku: 'SKU-DRINK', categoryId: 'cat-drink', name: 'Drink' }));

      const result = await repo.findByTenant(TENANT_A, { categoryId: 'cat-food' });
      expect(result.products).toHaveLength(1);
      expect(result.products[0].serialize().name).toBe('Food');
    });

    it('searches by name', async () => {
      await repo.save(createProduct(TENANT_A, { sku: 'SKU-KOPI', name: 'Kopi Gula Aren' }));
      await repo.save(createProduct(TENANT_A, { sku: 'SKU-TEH', name: 'Teh Manis' }));

      const result = await repo.findByTenant(TENANT_A, { search: 'Kopi' });
      expect(result.products).toHaveLength(1);
    });

    it('paginates results', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.save(createProduct(TENANT_A, { sku: `SKU-P${i}`, name: `Product ${i}` }));
      }

      const page1 = await repo.findByTenant(TENANT_A, { page: 1, limit: 2 });
      expect(page1.products).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page3 = await repo.findByTenant(TENANT_A, { page: 3, limit: 2 });
      expect(page3.products).toHaveLength(1);
    });

    it('returns empty for tenant with no products', async () => {
      await repo.save(createProduct(TENANT_A));

      const result = await repo.findByTenant(TENANT_B);
      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
