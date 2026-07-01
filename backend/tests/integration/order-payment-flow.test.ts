import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { buildIntegrationApp, IntegrationTestContext } from '../helpers/integration';

const payCashPayload = {
  items: [
    { productId: 'prod-1', quantity: 2, unitPrice: 25000 },
  ],
  amountPaid: 55500,
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

  describe('Full flow: pay cash (creates order + payment)', () => {
    it('should create order and process payment', async () => {
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send(payCashPayload);

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.payment.amount).toBe(55500);
      expect(payRes.body.data.payment.method).toBe('cash');
      expect(payRes.body.data.order.status).toBe('paid');
      expect(payRes.body.data.order.subtotal).toBe(50000);
      expect(payRes.body.data.order.total).toBe(55000);

      const orderId = payRes.body.data.order.id;
      const getRes = await request(ctx.app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.status).toBe('paid');
    });

    it('should return change when payment exceeds total', async () => {
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ ...payCashPayload, amountPaid: 100000 });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.payment.change).toBe(45000);
      expect(payRes.body.data.payment.amount).toBe(100000);
    });

    it('should apply nominal discount', async () => {
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ ...payCashPayload, discount: 5000, discountType: 'nominal' });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.order.subtotal).toBe(50000);
      expect(payRes.body.data.order.discount).toBe(5000);
      expect(payRes.body.data.order.total).toBe(50000);
    });

    it('should apply percentage discount', async () => {
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ ...payCashPayload, discount: 10, discountType: 'percentage' });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.order.subtotal).toBe(50000);
      expect(payRes.body.data.order.discount).toBe(5000);
      expect(payRes.body.data.order.total).toBe(50000);
    });

    it('should reject payment less than total', async () => {
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ ...payCashPayload, amountPaid: 100 });

      expect(payRes.status).toBe(400);
    });

    it('should list payments for an order', async () => {
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send(payCashPayload);

      const orderId = payRes.body.data.order.id;

      const listRes = await request(ctx.app)
        .get(`/api/payments/${orderId}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.orderId).toBe(orderId);
    });
  });

  describe('Validation & auth', () => {
    it('should reject pay cash without auth', async () => {
      const res = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .send({ items: [{ productId: 'p1', quantity: 1, unitPrice: 10000 }], amountPaid: 10000 });

      expect(res.status).toBe(401);
    });

    it('should reject pay cash with missing fields', async () => {
      const res = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject pay cash with empty items', async () => {
      const res = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ items: [], amountPaid: 1000 });

      expect(res.status).toBe(400);
    });

    it('should reject pay cash with zero amountPaid', async () => {
      const res = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ items: [{ productId: 'p1', quantity: 1, unitPrice: 10000 }], amountPaid: 0 });

      expect(res.status).toBe(400);
    });
  });
});
