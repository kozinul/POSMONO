import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { buildIntegrationApp, IntegrationTestContext } from '../helpers/integration';

const payCashPayload = {
  items: [
    { productId: 'prod-1', quantity: 2, unitPrice: 25000 },
  ],
  amountPaid: 60000,
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
      expect(payRes.body.data.payment.amount).toBe(60000);
      expect(payRes.body.data.payment.method).toBe('cash');
      expect(payRes.body.data.order.status).toBe('paid');
      expect(payRes.body.data.order.subtotal).toBe(50000);
      expect(payRes.body.data.order.total).toBe(55500);

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
      expect(payRes.body.data.payment.change).toBe(44500);
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
      expect(payRes.body.data.order.total).toBe(49950);
    });

    it('should apply percentage discount', async () => {
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ ...payCashPayload, discount: 10, discountType: 'percentage' });

      expect(payRes.status).toBe(200);
      expect(payRes.body.data.order.subtotal).toBe(50000);
      expect(payRes.body.data.order.discount).toBe(5000);
      expect(payRes.body.data.order.total).toBe(49950);
    });

    it('should reject payment less than total', async () => {
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ ...payCashPayload, amountPaid: 10000 });

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

  describe('Modifiers', () => {
    it('persists modifiers, resolves their prices, and does not double-count into unitPrice', async () => {
      await ctx.productModel.create({
        _id: 'prod-mod',
        tenantId: ctx.tenantId,
        sku: 'SKU-MOD',
        name: 'Kopi Hitam',
        categoryId: 'cat-1',
        basePrice: 16000,
        modifierGroupIds: ['grp-1'],
      });
      await ctx.modifierModel.create({
        _id: 'grp-1',
        tenantId: ctx.tenantId,
        name: 'Custom',
        displayType: 'checkbox',
        minSelections: 0,
        maxSelections: 5,
        required: false,
        options: [
          { id: 'opt-sugar', name: 'Extra Gula', priceAdjustment: 2000, isActive: true },
          { id: 'opt-large', name: 'Ukuran Besar', priceAdjustment: 3000, isActive: true },
        ],
      });

      const res = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({
          items: [{
            productId: 'prod-mod',
            productName: 'Kopi Hitam',
            categoryId: 'cat-1',
            quantity: 1,
            unitPrice: 21000,
            modifiers: [
              { groupId: 'grp-1', groupName: 'Custom', optionId: 'opt-large', optionName: 'Ukuran Besar', priceAdjustment: 999 },
              { groupId: 'grp-1', groupName: 'Custom', optionId: 'opt-sugar', optionName: 'Extra Gula', priceAdjustment: 999 },
            ],
          }],
          amountPaid: 100000,
        });

      expect(res.status).toBe(200);
      const order = res.body.data.order;
      expect(order.items[0].modifiers).toEqual([
        { groupId: 'grp-1', groupName: 'Custom', optionId: 'opt-large', optionName: 'Ukuran Besar', priceAdjustment: 3000 },
        { groupId: 'grp-1', groupName: 'Custom', optionId: 'opt-sugar', optionName: 'Extra Gula', priceAdjustment: 2000 },
      ]);
      expect(order.items[0].unitPrice).toBe(21000);
      expect(order.items[0].totalPrice).toBe(21000);
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
