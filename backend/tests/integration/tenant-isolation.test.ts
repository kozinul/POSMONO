import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { buildIntegrationApp, IntegrationTestContext } from '../helpers/integration';
import { generateTestToken } from '../helpers/auth';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const USER_A = 'user-a';
const USER_B = 'user-b';
const ISOLATION_PERMS = ['inventory:write', 'inventory:read', 'products:write', 'products:read'];

describe('Integration: Tenant Isolation', () => {
  let ctx: IntegrationTestContext;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await setupTestDb();
    ctx = await buildIntegrationApp({ permissions: ISOLATION_PERMS });
    tokenA = generateTestToken({ sub: USER_A, tenant: TENANT_A, permissions: ISOLATION_PERMS });
    tokenB = generateTestToken({ sub: USER_B, tenant: TENANT_B, permissions: ISOLATION_PERMS });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('Order isolation', () => {
    it('should not allow tenant B to access tenant A order', async () => {
      const createRes = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          items: [{ productId: 'p1', productName: 'Item A', quantity: 1, unitPrice: 10000, totalPrice: 10000, modifiers: [], tax: { rate: 0, amount: 0 } }],
          notes: '',
          source: 'pos',
        });

      const orderId = createRes.body.data.id;

      const getRes = await request(ctx.app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.status).toBe(400);
    });

    it('should not show tenant B orders in tenant A list', async () => {
      await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          items: [{ productId: 'p1', productName: 'Item A', quantity: 1, unitPrice: 10000, totalPrice: 10000, modifiers: [], tax: { rate: 0, amount: 0 } }],
          notes: '',
          source: 'pos',
        });

      await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          items: [{ productId: 'p2', productName: 'Item B', quantity: 1, unitPrice: 20000, totalPrice: 20000, modifiers: [], tax: { rate: 0, amount: 0 } }],
          notes: '',
          source: 'pos',
        });

      const listRes = await request(ctx.app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.meta.total).toBe(1);
    });
  });

  describe('Payment isolation', () => {
    it('should create payment scoped to tenant A', async () => {
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ items: [{ productId: 'p1', quantity: 1, unitPrice: 10000 }], amountPaid: 15000 });

      expect(payRes.status).toBe(200);
      const orderId = payRes.body.data.order.id;

      const getRes = await request(ctx.app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.status).toBe(400);
    });

    it('should not allow tenant B to see tenant A payment', async () => {
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ items: [{ productId: 'p1', quantity: 1, unitPrice: 10000 }], amountPaid: 15000 });

      const orderId = payRes.body.data.order.id;

      const listRes = await request(ctx.app)
        .get(`/api/payments/${orderId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(listRes.status).toBe(400);
    });
  });

  describe('Shift isolation', () => {
    it('should not allow tenant B to close tenant A shift', async () => {
      const openRes = await request(ctx.app)
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ openingBalance: 0 });

      const shiftId = openRes.body.data.id;

      const closeRes = await request(ctx.app)
        .post(`/api/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ physicalCash: 0 });

      expect(closeRes.status).toBe(404);
    });

    it('should not show tenant B shifts in tenant A list', async () => {
      await request(ctx.app)
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ openingBalance: 0 });

      await request(ctx.app)
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ openingBalance: 0 });

      const listRes = await request(ctx.app)
        .get('/api/shifts')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
    });

    it('should isolate getCurrent shift by tenant', async () => {
      await request(ctx.app)
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ openingBalance: 0 });

      const currentB = await request(ctx.app)
        .get('/api/shifts/current')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(currentB.body.data).toBeNull();
    });
  });

  describe('Product isolation', () => {
    it('should not allow tenant B to access tenant A product', async () => {
      const createRes = await request(ctx.app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ sku: 'SKU-A', name: 'Product A', categoryId: 'cat-1', basePrice: 10000 });

      const productId = createRes.body.data.id;

      const getRes = await request(ctx.app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.status).toBe(404);
    });

    it('should not show tenant B products in tenant A list', async () => {
      await request(ctx.app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ sku: 'SKU-A', name: 'Product A', categoryId: 'cat-1', basePrice: 10000 });

      await request(ctx.app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ sku: 'SKU-B', name: 'Product B', categoryId: 'cat-1', basePrice: 20000 });

      const listRes = await request(ctx.app)
        .get('/api/products')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.meta.total).toBe(1);
    });
  });

  describe('Inventory isolation', () => {
    it('should not allow tenant B to access tenant A stock', async () => {
      const createRes = await request(ctx.app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ sku: 'SKU-STOCK', name: 'Stock Item', categoryId: 'cat-1', basePrice: 10000 });

      const productId = createRes.body.data.id;

      const stockInRes = await request(ctx.app)
        .post('/api/inventory/stock-in')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ productId, quantity: 50 });

      expect(stockInRes.status).toBe(200);

      const getRes = await request(ctx.app)
        .get(`/api/inventory/${productId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.status).toBe(404);
    });

    it('should not show tenant B stock in tenant A low-stock list', async () => {
      const createResA = await request(ctx.app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ sku: 'SKU-LOW-A', name: 'Low Stock A', categoryId: 'cat-1', basePrice: 10000 });

      const createResB = await request(ctx.app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ sku: 'SKU-LOW-B1', name: 'Low Stock B', categoryId: 'cat-1', basePrice: 10000 });

      await request(ctx.app)
        .post('/api/inventory/stock-in')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ productId: createResA.body.data.id, quantity: 100 });

      await request(ctx.app)
        .post('/api/inventory/stock-in')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ productId: createResB.body.data.id, quantity: 2 });

      const lowStockRes = await request(ctx.app)
        .get('/api/inventory/low-stock')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(lowStockRes.status).toBe(200);
      expect(lowStockRes.body.data).toHaveLength(0);
    });
  });

  describe('Order mutation isolation', () => {
    async function createOrderAsTenantA(): Promise<string> {
      const res = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          items: [{ productId: 'p1', productName: 'Item A', quantity: 2, unitPrice: 10000, totalPrice: 20000, modifiers: [], tax: { rate: 0, amount: 0 } }],
          notes: '',
          source: 'pos',
        });
      expect(res.status).toBe(201);
      return res.body.data.id;
    }

    const mutationCases: Array<{ name: string; method: 'post' | 'put' | 'patch' | 'delete'; path: string; body?: unknown }> = [
      { name: 'PUT items', method: 'put', path: '/items', body: { items: [{ productId: 'p1', productName: 'X', quantity: 1, unitPrice: 10000, totalPrice: 10000, modifiers: [], tax: { rate: 0, amount: 0 } }] } },
      { name: 'POST pay', method: 'post', path: '/pay', body: { paymentBreakdown: [{ method: 'cash', code: 'C', amount: 20000, change: 0 }] } },
      { name: 'POST void', method: 'post', path: '/void', body: { reason: 'x', voidedByName: 'B' } },
      { name: 'POST close-bill', method: 'post', path: '/close-bill', body: {} },
      { name: 'POST void-item', method: 'post', path: '/void-item', body: { itemIndex: 0, reason: 'x', voidedByName: 'B' } },
      { name: 'POST void-payment', method: 'post', path: '/void-payment', body: { paymentIndex: 0, reason: 'x', voidedByName: 'B' } },
      { name: 'POST void-rollback', method: 'post', path: '/void-rollback', body: { reason: 'x', voidedByName: 'B' } },
      { name: 'POST topay', method: 'post', path: '/topay', body: { paymentBreakdown: [{ method: 'cash', code: 'C', amount: 20000, change: 0 }] } },
      { name: 'POST refund', method: 'post', path: '/refund', body: { reason: 'x', refundedByName: 'B' } },
      { name: 'POST apply-discount', method: 'post', path: '/apply-discount', body: { discountBreakdown: [] } },
      { name: 'POST service-charge', method: 'post', path: '/service-charge', body: { rate: 0.1 } },
      { name: 'PATCH reopen', method: 'patch', path: '/reopen' },
      { name: 'POST hold', method: 'post', path: '/hold' },
      { name: 'PATCH recall', method: 'patch', path: '/recall' },
      { name: 'POST split-item', method: 'post', path: '/split-item', body: { itemIndex: 0, quantities: [1, 1] } },
      { name: 'DELETE item', method: 'delete', path: '/item', body: { itemIndex: 0 } },
      { name: 'PATCH item/quantity', method: 'patch', path: '/item/quantity', body: { itemIndex: 0, quantity: 2 } },
    ];

    it.each(mutationCases)('tenant B cannot mutate a tenant A order via $name', async ({ method, path, body }) => {
      const orderId = await createOrderAsTenantA();

      const res = await request(ctx.app)
        [method](`/api/orders/${orderId}${path}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send(body ?? {});

      expect(res.status).toBe(404);
    });

    it('tenant A can mutate its own order (ALLOW)', async () => {
      const orderId = await createOrderAsTenantA();

      const holdRes = await request(ctx.app)
        .post(`/api/orders/${orderId}/hold`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      expect(holdRes.status).toBe(200);
      expect(holdRes.body.data.status).toBe('held');
    });

    it('a denied mutation leaves the tenant A order untouched', async () => {
      const orderId = await createOrderAsTenantA();

      await request(ctx.app)
        .post(`/api/orders/${orderId}/void`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ reason: 'x', voidedByName: 'B' });

      const getRes = await request(ctx.app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.status).toBe('draft');
    });
  });
});