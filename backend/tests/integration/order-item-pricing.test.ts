import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { buildIntegrationApp, IntegrationTestContext } from '../helpers/integration';

/**
 * C1b regression: PUT /orders/:id(/items) must re-price items from the catalog.
 *
 * Attack it closes: save a held bill with `unitPrice: 1`, then pay it through
 * POST /payments/process — that path trusts `order.total`, so a client-priced
 * bill would settle for one rupiah.
 */
describe('Integration: order item pricing is server-authoritative (C1b)', () => {
  let ctx: IntegrationTestContext;

  beforeAll(async () => {
    await setupTestDb();
    ctx = await buildIntegrationApp({ permissions: ['orders:read', 'orders:write'] });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  async function seedProduct(overrides: Record<string, unknown> = {}) {
    await ctx.productModel.create({
      _id: 'p1',
      tenantId: ctx.tenantId,
      sku: 'SKU-1',
      name: 'Nasi Goreng',
      categoryId: 'cat-1',
      basePrice: 25000,
      isActive: true,
      ...overrides,
    });
  }

  async function createOrder(itemOverride: Record<string, unknown> = {}) {
    const res = await request(ctx.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        items: [
          {
            productId: 'p1',
            productName: 'Nasi Goreng',
            quantity: 2,
            unitPrice: 25000,
            totalPrice: 50000,
            variantId: null,
            modifiers: [],
            tax: { rate: 0, amount: 0 },
            ...itemOverride,
          },
        ],
        source: 'pos',
      });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  function replaceItems(orderId: string, items: Record<string, unknown>[]) {
    return request(ctx.app)
      .put(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ items });
  }

  const tamperedItem = {
    productId: 'p1',
    productName: 'Nasi Goreng',
    quantity: 2,
    unitPrice: 1,
    totalPrice: 2,
    variantId: null,
    modifiers: [],
    tax: { rate: 0, amount: 0 },
  };

  it('ALLOW: replaces items at the catalog price, ignoring the client unitPrice', async () => {
    await seedProduct();
    const orderId = await createOrder();

    const res = await replaceItems(orderId, [tamperedItem]);

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].unitPrice).toBe(25000);
    expect(res.body.data.items[0].totalPrice).toBe(50000);
    expect(res.body.data.total).toBe(50000);
  });

  it('DENY: rejects a product that does not exist in the tenant catalog', async () => {
    const orderId = await createOrder();

    const res = await replaceItems(orderId, [tamperedItem]);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Produk tidak ditemukan');
  });

  it('DENY: rejects a product owned by another tenant', async () => {
    await seedProduct({ tenantId: 'tenant-other' });
    const orderId = await createOrder();

    const res = await replaceItems(orderId, [tamperedItem]);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Produk tidak ditemukan');
  });

  it('END-TO-END DENY: a tampered bill cannot be settled for less than the catalog total', async () => {
    await seedProduct();
    const orderId = await createOrder();

    const replaceRes = await replaceItems(orderId, [tamperedItem]);
    expect(replaceRes.status).toBe(200);
    expect(replaceRes.body.data.total).toBe(50000);

    const underpay = await request(ctx.app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ orderId, amount: 1, method: 'cash' });

    expect(underpay.status).toBe(400);

    const settle = await request(ctx.app)
      .post('/api/payments/process')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ orderId, amount: 50000, method: 'cash' });

    expect(settle.status).toBe(200);
    expect(settle.body.data.order.status).toBe('paid');
  });
});
