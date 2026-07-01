import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductService } from '../../src/core/catalog/application/services/ProductService';
import { Product } from '../../src/core/catalog/domain/Product';
import { ConflictError, NotFoundError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';

function createMockRepo() {
  return { save: vi.fn(), findById: vi.fn(), findBySku: vi.fn(), findByBarcode: vi.fn(), findByTenant: vi.fn(), delete: vi.fn() };
}

const validInput = {
  tenantId: TENANT_ID,
  sku: 'SKU-001',
  barcode: '8991234567890',
  name: 'Kopi Gula Aren',
  description: 'Kopi dengan gula aren asli',
  categoryId: 'cat-1',
  basePrice: 25000,
  tags: ['kopi'],
  imageUrls: [],
  isActive: true,
  metadata: {},
};

function createTestProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return Product.create({
    tenantId: TENANT_ID,
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

describe('ProductService', () => {
  let repo: ReturnType<typeof createMockRepo>;
  let service: ProductService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new ProductService(repo);
  });

  describe('create', () => {
    it('creates a product with correct properties', async () => {
      repo.findBySku.mockResolvedValue(null);

      const product = await service.create(validInput);

      const data = product.serialize();
      expect(data.name).toBe('Kopi Gula Aren');
      expect(data.sku).toBe('SKU-001');
      expect(data.basePrice).toBe(25000);
      expect(data.tenantId).toBe(TENANT_ID);
      expect(data.isActive).toBe(true);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictError when SKU already exists in tenant', async () => {
      const existing = Product.create(validInput);
      repo.findBySku.mockResolvedValue(existing);

      await expect(service.create(validInput)).rejects.toThrow(ConflictError);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('generates a unique product ID', async () => {
      repo.findBySku.mockResolvedValue(null);

      const p1 = await service.create(validInput);
      const p2 = await service.create({ ...validInput, sku: 'SKU-002' });

      expect(p1.id.toValue()).not.toBe(p2.id.toValue());
    });

    it('publishes domain event on creation', async () => {
      repo.findBySku.mockResolvedValue(null);

      const product = await service.create(validInput);

      const events = product.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('catalog.product.created');
    });
  });

  describe('getById', () => {
    it('returns product when found and owned by tenant', async () => {
      const product = Product.create(validInput);
      repo.findById.mockResolvedValue(product);

      const result = await service.getById(product.id.toValue(), TENANT_ID);
      expect(result.serialize().sku).toBe('SKU-001');
    });

    it('throws NotFoundError when product belongs to different tenant', async () => {
      const product = Product.create(validInput);
      repo.findById.mockResolvedValue(product);

      await expect(service.getById(product.id.toValue(), 'other-tenant')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when product does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.getById('nonexistent', TENANT_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('updates product properties', async () => {
      const product = Product.create(validInput);
      repo.findById.mockResolvedValue(product);

      const updated = await service.update(product.id.toValue(), TENANT_ID, {
        name: 'Kopi Gula Aren Jumbo',
        basePrice: 30000,
      });

      expect(updated.serialize().name).toBe('Kopi Gula Aren Jumbo');
      expect(updated.serialize().basePrice).toBe(30000);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError when product belongs to different tenant', async () => {
      const product = Product.create(validInput);
      repo.findById.mockResolvedValue(product);

      await expect(
        service.update(product.id.toValue(), 'other-tenant', { name: 'Hacked' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when updating to an existing SKU', async () => {
      const product = Product.create({ ...validInput, sku: 'SKU-001' });
      const otherProduct = Product.create({ ...validInput, sku: 'SKU-002' });
      repo.findById.mockResolvedValue(product);
      repo.findBySku.mockResolvedValue(otherProduct);

      await expect(
        service.update(product.id.toValue(), TENANT_ID, { sku: 'SKU-002' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('list', () => {
    it('returns products with pagination', async () => {
      const product = Product.create(validInput);
      repo.findByTenant.mockResolvedValue({ products: [product], total: 1 });

      const result = await service.list(TENANT_ID);

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(repo.findByTenant).toHaveBeenCalledWith(TENANT_ID, undefined);
    });

    it('passes filter options to repository', async () => {
      repo.findByTenant.mockResolvedValue({ products: [], total: 0 });

      await service.list(TENANT_ID, { categoryId: 'cat-1', search: 'kopi', page: 2, limit: 10 });

      expect(repo.findByTenant).toHaveBeenCalledWith(TENANT_ID, {
        categoryId: 'cat-1',
        search: 'kopi',
        page: 2,
        limit: 10,
      });
    });
  });

  describe('delete', () => {
    it('soft-deletes by setting isActive to false', async () => {
      const product = Product.create(validInput);
      repo.findById.mockResolvedValue(product);

      await service.delete(product.id.toValue(), TENANT_ID);

      expect(product.serialize().isActive).toBe(false);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError when product belongs to different tenant', async () => {
      const product = Product.create(validInput);
      repo.findById.mockResolvedValue(product);

      await expect(service.delete(product.id.toValue(), 'other-tenant')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findByBarcode', () => {
    it('returns product when barcode matches in tenant', async () => {
      const product = Product.create({ ...validInput, barcode: '8991234567890' });
      repo.findByBarcode.mockResolvedValue(product);

      const result = await service.findByBarcode(TENANT_ID, '8991234567890');

      expect(result.serialize().barcode).toBe('8991234567890');
      expect(repo.findByBarcode).toHaveBeenCalledWith(TENANT_ID, '8991234567890');
    });

    it('throws NotFoundError when barcode not found', async () => {
      repo.findByBarcode.mockResolvedValue(null);

      await expect(service.findByBarcode(TENANT_ID, '0000000000000')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for empty barcode', async () => {
      await expect(service.findByBarcode(TENANT_ID, '')).rejects.toThrow(NotFoundError);
      expect(repo.findByBarcode).not.toHaveBeenCalled();
    });

    it('respects tenant isolation', async () => {
      const product = Product.create({ ...validInput, barcode: '8991234567890' });
      repo.findByBarcode.mockResolvedValue(null);

      await expect(service.findByBarcode('other-tenant', '8991234567890')).rejects.toThrow(NotFoundError);
      expect(repo.findByBarcode).toHaveBeenCalledWith('other-tenant', '8991234567890');
    });
  });
});
