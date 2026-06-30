import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import { MongoOrderRepository } from '../../src/core/ordering/infrastructure/persistence/MongoOrderRepository';
import { OrderSchema } from '../../src/core/ordering/infrastructure/persistence/schemas/OrderSchema';
import { Order } from '../../src/core/ordering/domain/Order';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

let model: Model<any>;
let repo: MongoOrderRepository;

function createOrder(tenantId: string, overrides: Record<string, unknown> = {}) {
  return Order.create({
    tenantId,
    items: [{ productId: 'p1', productName: 'Nasi Goreng', quantity: 2, unitPrice: 25000, totalPrice: 50000, variantId: null, modifiers: [], tax: { rate: 0, amount: 0 } }],
    subtotal: 50000,
    discount: 0,
    tax: 0,
    total: 50000,
    customerId: null,
    cashierId: 'cashier-1',
    notes: '',
    source: 'pos',
    metadata: {},
    ...overrides,
  });
}

beforeAll(async () => {
  await setupTestDb();
  model = mongoose.model('Order', OrderSchema);
  repo = new MongoOrderRepository(model);
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('MongoOrderRepository', () => {
  describe('save + findById', () => {
    it('saves and retrieves an order', async () => {
      const order = createOrder(TENANT_A);
      await repo.save(order);

      const found = await repo.findById(order.id.toValue());
      expect(found).not.toBeNull();
      expect(found!.serialize().orderNumber).toBe(order.serialize().orderNumber);
      expect(found!.serialize().tenantId).toBe(TENANT_A);
      expect(found!.serialize().status).toBe('draft');
    });

    it('returns null for non-existent order', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });

    it('updates existing order on second save', async () => {
      const order = createOrder(TENANT_A, { metadata: { t: 'update' } });
      await repo.save(order);

      order.markPaid();
      await repo.save(order);

      const found = await repo.findById(order.id.toValue());
      expect(found!.serialize().status).toBe('paid');
      expect(found!.serialize().paymentStatus).toBe('completed');
      expect(found!.serialize().paidAt).toBeInstanceOf(Date);
    });
  });

  describe('findByTenant', () => {
    it('returns orders for a specific tenant only', async () => {
      await repo.save(createOrder(TENANT_A, { metadata: { t: 'a' } }));
      await new Promise((r) => setTimeout(r, 10));
      await repo.save(createOrder(TENANT_B, { metadata: { t: 'b' } }));

      const result = await repo.findByTenant(TENANT_A);
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].serialize().tenantId).toBe(TENANT_A);
    });

    it('filters by status', async () => {
      const draft = createOrder(TENANT_A, { metadata: { type: 'draft' } });
      await repo.save(draft);
      await new Promise((r) => setTimeout(r, 10));
      const paid = createOrder(TENANT_A, { metadata: { type: 'paid' } });
      paid.markPaid();
      await repo.save(paid);

      const result = await repo.findByTenant(TENANT_A, { status: 'paid' });
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].serialize().status).toBe('paid');
    });

    it('filters by date range', async () => {
      await repo.save(createOrder(TENANT_A, { metadata: { t: 'date' } }));

      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const result = await repo.findByTenant(TENANT_A, { dateFrom: yesterday, dateTo: tomorrow });
      expect(result.total).toBe(1);
    });

    it('paginates results', async () => {
      for (let i = 0; i < 5; i++) {
        const order = createOrder(TENANT_A, { metadata: { idx: i } });
        await new Promise((r) => setTimeout(r, 5));
        await repo.save(order);
      }

      const page1 = await repo.findByTenant(TENANT_A, { page: 1, limit: 2 });
      expect(page1.orders).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page3 = await repo.findByTenant(TENANT_A, { page: 3, limit: 2 });
      expect(page3.orders).toHaveLength(1);
    });

    it('returns empty for tenant with no orders', async () => {
      await repo.save(createOrder(TENANT_A, { metadata: { t: 'a' } }));

      const result = await repo.findByTenant(TENANT_B);
      expect(result.orders).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getDailySales', () => {
    it('returns daily sales summary for paid orders', async () => {
      const order = createOrder(TENANT_A, { metadata: { type: 'sales-test' } });
      order.markPaid();
      await repo.save(order);

      const today = new Date().toISOString().split('T')[0];
      const sales = await repo.getDailySales(TENANT_A, today);

      expect(sales.totalOrders).toBe(1);
      expect(sales.totalRevenue).toBe(50000);
      expect(sales.totalItems).toBe(2);
    });

    it('returns zeroes for date with no sales', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const sales = await repo.getDailySales(TENANT_A, yesterday);
      expect(sales.totalOrders).toBe(0);
      expect(sales.totalRevenue).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('returns dashboard summary counts', async () => {
      const paid = createOrder(TENANT_A, { metadata: { type: 'paid' } });
      paid.markPaid();
      await repo.save(paid);
      await new Promise((r) => setTimeout(r, 5));
      const draft = createOrder(TENANT_A, { metadata: { type: 'draft' } });
      await repo.save(draft);

      const summary = await repo.getSummary(TENANT_A);
      expect(summary.todayRevenue).toBe(50000);
      expect(summary.todayOrders).toBe(1);
      expect(summary.pendingOrders).toBe(1);
    });
  });
});
