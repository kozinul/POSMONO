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

  const payments: any[] = [];

  router.post('/payments/pay-cash', authenticate, (req, res) => {
    const { orderId, amount } = req.body;

    if (!orderId || !amount) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    if (amount < 50000) {
      res.status(400).json({ success: false, error: 'Insufficient amount' });
      return;
    }

    const payment = {
      id: `pay-${Date.now()}`,
      tenantId: req.tenantId,
      orderId,
      amount,
      status: 'completed',
      method: 'cash',
      referenceNumber: `CASH-${Date.now().toString(36).toUpperCase()}`,
      change: amount - 50000,
      paidAt: new Date().toISOString(),
    };
    payments.push(payment);

    res.json({
      success: true,
      data: {
        payment,
        order: { id: orderId, status: 'paid', paymentStatus: 'completed' },
      },
    });
  });

  router.get('/payments', authenticate, (req, res) => {
    const tenantPayments = payments.filter((p) => p.tenantId === req.tenantId);
    res.json({ success: true, data: tenantPayments });
  });

  app.use('/api', router);
  app.use(errorHandler);

  return app;
}

describe('Payment Routes', () => {
  let app: express.Express;
  let token: string;

  beforeAll(() => {
    app = createTestApp();
    token = generateTestToken();
  });

  describe('POST /api/payments/pay-cash', () => {
    it('returns 200 for valid cash payment', async () => {
      const res = await request(app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId: 'order-123', amount: 100000 });

      expect(res.status).toBe(200);
      expect(res.body.data.payment.status).toBe('completed');
      expect(res.body.data.order.status).toBe('paid');
      expect(res.body.data.payment.method).toBe('cash');
    });

    it('returns change amount when overpaid', async () => {
      const res = await request(app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId: 'order-123', amount: 100000 });

      expect(res.body.data.payment.change).toBe(50000);
    });

    it('returns 400 for insufficient amount', async () => {
      const res = await request(app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId: 'order-123', amount: 1000 });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/payments/pay-cash')
        .send({ orderId: 'order-123', amount: 100000 });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/payments', () => {
    it('returns payment list', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });
});
