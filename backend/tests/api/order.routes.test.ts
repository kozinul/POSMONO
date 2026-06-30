import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authenticate } from '../../src/@shared/interfaces/middleware/authenticate';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { generateTestToken } from '../helpers/auth';

function createTestApp() {
  const app = express();
  app.use(express.json());

  const router = express.Router();

  let orders: any[] = [];
  let nextId = 1;

  router.get('/', authenticate, (req, res) => {
    const tenantOrders = orders.filter((o) => o.tenantId === req.tenantId);
    res.json({
      success: true,
      data: tenantOrders,
      meta: { total: tenantOrders.length, page: 1, limit: 50 },
    });
  });

  router.post('/', authenticate, (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'Validation error' });
      return;
    }

    const order = {
      id: `order-${nextId++}`,
      tenantId: req.tenantId,
      orderNumber: `ORD-${Date.now()}`,
      status: 'draft',
      items,
      subtotal: items.reduce((s: number, i: any) => s + i.totalPrice, 0),
      total: items.reduce((s: number, i: any) => s + i.totalPrice, 0),
      paymentStatus: 'pending',
      cashierId: req.userId,
      source: 'pos',
      createdAt: new Date().toISOString(),
    };
    orders.push(order);
    res.status(201).json({ success: true, data: order });
  });

  router.get('/:id', authenticate, (req, res) => {
    const order = orders.find((o) => o.id === req.params.id && o.tenantId === req.tenantId);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    res.json({ success: true, data: order });
  });

  app.use('/api/orders', router);
  app.use(errorHandler);

  return app;
}

describe('Order Routes', () => {
  let app: express.Express;
  let token: string;

  beforeAll(() => {
    app = createTestApp();
    token = generateTestToken();
  });

  describe('POST /api/orders', () => {
    const validOrder = {
      items: [
        { productId: 'p1', productName: 'Item A', quantity: 2, unitPrice: 10000, totalPrice: 20000, variantId: null, modifiers: [], tax: { rate: 0, amount: 0 } },
      ],
    };

    it('returns 201 for valid order', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(validOrder);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.orderNumber).toMatch(/^ORD-/);
    });

    it('returns 400 for empty items', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send(validOrder);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/orders', () => {
    it('returns order list', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
    });
  });

  describe('GET /api/orders/:id', () => {
    it('returns order by ID', async () => {
      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ productId: 'p1', productName: 'Test', quantity: 1, unitPrice: 10000, totalPrice: 10000, variantId: null, modifiers: [], tax: { rate: 0, amount: 0 } }] });

      const orderId = createRes.body.data.id;
      const res = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(orderId);
    });

    it('returns 404 for non-existent order', async () => {
      const res = await request(app)
        .get('/api/orders/nonexistent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
