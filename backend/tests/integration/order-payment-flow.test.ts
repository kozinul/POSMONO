import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { buildIntegrationApp, IntegrationTestContext } from '../helpers/integration';
import { generateTestToken } from '../helpers/auth';

const orderPayload = {
  items: [
    {
      productId: 'prod-1',
      productName: 'Nasi Goreng',
      quantity: 2,
      unitPrice: 25000,
      totalPrice: 50000,
      modifiers: [],
      tax: { rate: 0.11, amount: 5500 },
    },
  ],
  notes: 'test order',
  source: 'pos',
};

describe('Integration: Order-to-Payment Flow', () => {
  let ctx: IntegrationTestContext;

  beforeAll(async () => {
    await setupTestDb();
    ctx = await buildIntegrationApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('Full flow: create order → pay cash', () => {
    it('should create an order, pay cash, and reflect paid status', async () => {
      const createRes = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send(orderPayload);

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.items).toHaveLength(1);
      const orderId = createRes.body.data.id;

      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ orderId, amount: 55500 });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.payment.amount).toBe(55500);
      expect(payRes.body.data.payment.method).toBe('cash');
      expect(payRes.body.data.order.status).toBe('paid');

      const getRes = await request(ctx.app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.status).toBe('paid');
    });

    it('should return change when payment exceeds total', async () => {
      const createRes = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send(orderPayload);

      const orderId = createRes.body.data.id;

      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ orderId, amount: 100000 });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.payment.change).toBe(44500);
      expect(payRes.body.data.payment.amount).toBe(100000);
    });

    it('should reject payment less than total', async () => {
      const createRes = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send(orderPayload);

      const orderId = createRes.body.data.id;

      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ orderId, amount: 100 });

      expect(payRes.status).toBe(400);
      expect(payRes.body.error.message).toMatch(/insufficient/i);
    });

    it('should reject double payment', async () => {
      const createRes = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send(orderPayload);

      const orderId = createRes.body.data.id;

      await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ orderId, amount: 55500 });

      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ orderId, amount: 55500 });

      expect(payRes.status).toBe(400);
    });

    it('should list payments for an order', async () => {
      const createRes = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send(orderPayload);

      const orderId = createRes.body.data.id;

      await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ orderId, amount: 55500 });

      const listRes = await request(ctx.app)
        .get(`/api/payments/${orderId}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.orderId).toBe(orderId);
    });
  });

  describe('Tenant isolation', () => {
    it('should not allow tenant A to access tenant B order', async () => {
      const createRes = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send(orderPayload);

      const orderId = createRes.body.data.id;

      const otherToken = generateTestToken({ sub: 'other-user', tenant: 'other-tenant' });

      const getRes = await request(ctx.app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(getRes.status).toBe(400);
    });

    it('should not allow tenant A to pay tenant B order', async () => {
      const otherToken = generateTestToken({ sub: 'other-user', tenant: 'other-tenant' });

      const createRes = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${otherToken}`)
        .send(orderPayload);

      const orderId = createRes.body.data.id;

      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ orderId, amount: 55500 });

      expect(payRes.status).toBe(404);
    });

    it('should not allow tenant A to see tenant B payment', async () => {
      const otherToken = generateTestToken({ sub: 'other-user', tenant: 'other-tenant' });

      const createRes = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${otherToken}`)
        .send(orderPayload);

      const orderId = createRes.body.data.id;

      await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ orderId, amount: 55500 });

      const listRes = await request(ctx.app)
        .get(`/api/payments/${orderId}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(listRes.status).toBe(400);
    });
  });

  describe('Validation & auth', () => {
    it('should reject create order without auth', async () => {
      const res = await request(ctx.app)
        .post('/api/orders')
        .send(orderPayload);

      expect(res.status).toBe(401);
    });

    it('should reject pay cash without auth', async () => {
      const res = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .send({ orderId: 'none', amount: 1000 });

      expect(res.status).toBe(401);
    });

    it('should reject create order with empty items', async () => {
      const res = await request(ctx.app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ items: [] });

      expect(res.status).toBe(400);
    });

    it('should reject pay cash with missing fields', async () => {
      const res = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject pay cash with zero amount', async () => {
      const res = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ orderId: 'some-id', amount: 0 });

      expect(res.status).toBe(400);
    });
  });
});
