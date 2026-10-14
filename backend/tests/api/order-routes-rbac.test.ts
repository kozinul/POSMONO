import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { RequestHandler } from 'express';
import { createOrderRoutes } from '../../src/core/ordering/interfaces/http/routes/order.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { generateTestToken } from '../helpers/auth';

const noopController = async (_req: any, res: any) => res.json({ success: true, data: { ok: true } });

/** Every OrderController method the router can reach, stubbed to succeed. */
function stubController() {
  return {
    list: noopController,
    getById: noopController,
    invoice: noopController,
    create: noopController,
    update: noopController,
    pay: noopController,
    voidOrder: noopController,
    closeBill: noopController,
    voidItem: noopController,
    voidPayment: noopController,
    voidAndRollback: noopController,
    topay: noopController,
    refund: noopController,
    applyDiscount: noopController,
    setServiceCharge: noopController,
    reopen: noopController,
    hold: noopController,
    recall: noopController,
    replaceItems: noopController,
    splitItem: noopController,
    removeItem: noopController,
    updateItemQuantity: noopController,
  } as never;
}

const passthroughOutlet: RequestHandler = (_req, _res, next) => next();

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/orders', createOrderRoutes(stubController(), passthroughOutlet));
  app.use(errorHandler);
  return app;
}

describe('Order Routes RBAC (real order.routes)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = buildApp();
  });

  const readToken = generateTestToken({ sub: 'u-read', permissions: ['orders:read'] });
  const writeToken = generateTestToken({ sub: 'u-write', permissions: ['orders:read', 'orders:write'] });
  const cashierToken = generateTestToken({ sub: 'u-cashier', role: 'cashier', permissions: ['orders:read', 'orders:write'] });
  const payToken = generateTestToken({ sub: 'u-pay', permissions: ['payments:write'] });
  const cancelToken = generateTestToken({ sub: 'u-cancel', permissions: ['orders:cancel'] });
  const noPermToken = generateTestToken({ sub: 'u-none', permissions: [] });

  describe('DENY without permission', () => {
    it('GET / is 401 without a token', async () => {
      const res = await request(app).get('/api/orders');
      expect(res.status).toBe(401);
    });

    it('GET / is 403 without orders:read', async () => {
      const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${noPermToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /:id and /:id/invoice require orders:read', async () => {
      const detail = await request(app).get('/api/orders/o1').set('Authorization', `Bearer ${noPermToken}`);
      const invoice = await request(app).get('/api/orders/o1/invoice').set('Authorization', `Bearer ${noPermToken}`);
      expect(detail.status).toBe(403);
      expect(invoice.status).toBe(403);
    });

    it('POST / requires orders:write', async () => {
      const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${readToken}`).send({});
      expect(res.status).toBe(403);
    });
  });

  describe('ALLOW with permission', () => {
    it('GET /, /:id, /:id/invoice succeed with orders:read', async () => {
      const list = await request(app).get('/api/orders').set('Authorization', `Bearer ${readToken}`);
      const detail = await request(app).get('/api/orders/o1').set('Authorization', `Bearer ${readToken}`);
      const invoice = await request(app).get('/api/orders/o1/invoice').set('Authorization', `Bearer ${readToken}`);
      expect(list.status).toBe(200);
      expect(detail.status).toBe(200);
      expect(invoice.status).toBe(200);
    });

    it('POST / succeeds with orders:write', async () => {
      const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${writeToken}`).send({});
      expect(res.status).toBe(200);
    });
  });

  // route -> the permission that unlocks it (void routes intentionally absent)
  const writeCases: Array<{ name: string; method: Method; path: string }> = [
    { name: 'POST /', method: 'post', path: '/' },
    { name: 'PUT /:id', method: 'put', path: '/o1' },
    { name: 'PUT /:id/items', method: 'put', path: '/o1/items' },
    { name: 'PATCH /:id/item/quantity', method: 'patch', path: '/o1/item/quantity' },
    { name: 'DELETE /:id/item', method: 'delete', path: '/o1/item' },
    { name: 'POST /:id/hold', method: 'post', path: '/o1/hold' },
    { name: 'PATCH /:id/recall', method: 'patch', path: '/o1/recall' },
    { name: 'POST /:id/close-bill', method: 'post', path: '/o1/close-bill' },
    { name: 'POST /:id/split-item', method: 'post', path: '/o1/split-item' },
  ];

  const payCases: Array<{ name: string; path: string }> = [
    { name: 'POST /:id/pay', path: '/o1/pay' },
    { name: 'POST /:id/topay', path: '/o1/topay' },
    { name: 'POST /:id/refund', path: '/o1/refund' },
  ];

  const cancelCases: Array<{ name: string; method: Method; path: string }> = [
    { name: 'POST /:id/apply-discount', method: 'post', path: '/o1/apply-discount' },
    { name: 'POST /:id/service-charge', method: 'post', path: '/o1/service-charge' },
    { name: 'PATCH /:id/reopen', method: 'patch', path: '/o1/reopen' },
  ];

  it.each(writeCases)('$name is blocked without orders:write', async ({ method, path }) => {
    const res = await request(app)[method](`/api/orders${path}`).set('Authorization', `Bearer ${readToken}`).send({});
    expect(res.status).toBe(403);
  });

  it.each(writeCases)('$name succeeds with orders:write', async ({ method, path }) => {
    const res = await request(app)[method](`/api/orders${path}`).set('Authorization', `Bearer ${writeToken}`).send({});
    expect(res.status).toBe(200);
  });

  it.each(payCases)('$name is blocked without payments:write', async ({ path }) => {
    const res = await request(app).post(`/api/orders${path}`).set('Authorization', `Bearer ${writeToken}`).send({});
    expect(res.status).toBe(403);
  });

  it.each(payCases)('$name succeeds with payments:write', async ({ path }) => {
    const res = await request(app).post(`/api/orders${path}`).set('Authorization', `Bearer ${payToken}`).send({});
    expect(res.status).toBe(200);
  });

  it.each(cancelCases)('$name is blocked without orders:cancel', async ({ method, path }) => {
    const res = await request(app)[method](`/api/orders${path}`).set('Authorization', `Bearer ${writeToken}`).send({});
    expect(res.status).toBe(403);
  });

  it.each(cancelCases)('$name succeeds with orders:cancel', async ({ method, path }) => {
    const res = await request(app)[method](`/api/orders${path}`).set('Authorization', `Bearer ${cancelToken}`).send({});
    expect(res.status).toBe(200);
  });

  describe('Void routes stay open to authenticated cashiers (manager-PIN flow)', () => {
    const voidCases: Array<{ name: string; path: string }> = [
      { name: 'POST /:id/void', path: '/o1/void' },
      { name: 'POST /:id/void-item', path: '/o1/void-item' },
      { name: 'POST /:id/void-payment', path: '/o1/void-payment' },
      { name: 'POST /:id/void-rollback', path: '/o1/void-rollback' },
    ];

    it.each(voidCases)('$name reaches the controller with only orders:read/write', async ({ path }) => {
      const res = await request(app).post(`/api/orders${path}`).set('Authorization', `Bearer ${cashierToken}`).send({});
      expect(res.status).toBe(200);
    });

    it.each(voidCases)('$name still requires authentication (401 without a token)', async ({ path }) => {
      const res = await request(app).post(`/api/orders${path}`).send({});
      expect(res.status).toBe(401);
    });
  });
});
