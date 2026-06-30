import { describe, it, expect } from 'vitest';
import { Product } from '../Product';
import { validProductInput } from '../../../../../tests/fixtures/catalog.fixtures';

describe('Product', () => {
  describe('create', () => {
    it('creates a product with given fields', () => {
      const product = Product.create(validProductInput);

      const data = product.serialize();
      expect(data.name).toBe('Kopi Gula Aren');
      expect(data.sku).toBe('SKU-001');
      expect(data.barcode).toBe('8991234567890');
      expect(data.basePrice).toBe(25000);
      expect(data.isActive).toBe(true);
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });

    it('generates a unique id', () => {
      const p1 = Product.create(validProductInput);
      const p2 = Product.create(validProductInput);

      expect(p1.serialize().id).not.toBe(p2.serialize().id);
    });

    it('emits catalog.product.created domain event', () => {
      const product = Product.create(validProductInput);

      const events = product.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('catalog.product.created');
      expect(events[0].aggregateId).toBe(product.id.toValue());
      expect(events[0].aggregateType).toBe('Product');
      expect(events[0].tenantId).toBe('tenant-test-1');
      expect(events[0].payload.sku).toBe('SKU-001');
      expect(events[0].payload.name).toBe('Kopi Gula Aren');
    });
  });

  describe('update', () => {
    it('updates provided fields', () => {
      const product = Product.create(validProductInput);
      product.update({ name: 'Kopi Gula Aren Besar', basePrice: 30000 });

      const data = product.serialize();
      expect(data.name).toBe('Kopi Gula Aren Besar');
      expect(data.basePrice).toBe(30000);
    });

    it('does not change fields not provided', () => {
      const product = Product.create(validProductInput);
      product.update({ name: 'Updated Name' });

      const data = product.serialize();
      expect(data.name).toBe('Updated Name');
      expect(data.sku).toBe('SKU-001');
      expect(data.basePrice).toBe(25000);
    });

    it('updates tags when provided', () => {
      const product = Product.create(validProductInput);
      product.update({ tags: ['best-seller', 'limited'] });

      expect(product.serialize().tags).toEqual(['best-seller', 'limited']);
    });

    it('updates updatedAt timestamp', () => {
      const product = Product.create(validProductInput);
      const before = product.serialize().updatedAt;

      product.update({ name: 'New Name' });

      expect(product.serialize().updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it('can deactivate a product', () => {
      const product = Product.create(validProductInput);
      product.update({ isActive: false });

      expect(product.serialize().isActive).toBe(false);
    });
  });

  describe('serialize', () => {
    it('returns all product properties', () => {
      const product = Product.create(validProductInput);
      const data = product.serialize();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('tenantId');
      expect(data).toHaveProperty('sku');
      expect(data).toHaveProperty('barcode');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('categoryId');
      expect(data).toHaveProperty('basePrice');
      expect(data).toHaveProperty('imageUrls');
      expect(data).toHaveProperty('tags');
      expect(data).toHaveProperty('isActive');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
    });
  });

  describe('hydrate', () => {
    it('restores a product from persisted data', () => {
      const product = Product.create(validProductInput);
      product.update({ basePrice: 30000 });
      const data = product.serialize();
      const restored = Product.hydrate(data);

      expect(restored.serialize()).toEqual(data);
      expect(restored.serialize().basePrice).toBe(30000);
    });
  });
});
