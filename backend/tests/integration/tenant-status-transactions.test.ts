import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { buildIntegrationApp, IntegrationTestContext } from '../helpers/integration';

const payCashPayload = {
  items: [{ productId: 'prod-1', quantity: 2, unitPrice: 25000 }],
  amountPaid: 60000,
};

const orderPayload = {
  items: [
    {
      productId: 'p1',
      productName: 'Item A',
      quantity: 1,
      unitPrice: 10000,
      totalPrice: 10000,
      modifiers: [],
      tax: { rate: 0, amount: 0 },
    },
  ],
  notes: '',
  source: 'pos',
};

/**
 * Server-side half of the POS status alert: a tenant whose status (or active
 * period) forbids trading must not move money even though reads stay open for
 * the alert itself. DENY/ALLOW pairs per status — money path, not just happy
 * path.
 */
describe('Integration: tenant status gate on POS mutations', () => {
  let ctx: IntegrationTestContext;

  beforeAll(async () => {
    await setupTestDb();
    ctx = await buildIntegrationApp({ statusGate: true });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  async function seedTenant(status: string, overrides: Record<string, unknown> = {}) {
    await ctx.tenantModel.create({
      _id: ctx.tenantId,
      name: 'Toko Integrasi',
      slug: 'integration-tenant',
      ownerId: 'owner-1',
      businessType: 'retail',
      databaseName: 'test',
      billingEmail: 'billing@test.dev',
      status,
      ...overrides,
    });
  }

  it('DENY: suspended tenant cannot take payment — 403 and no payment record', async () => {
    await seedTenant('suspended');

    const res = await request(ctx.app)
      .post('/api/payments/pay-cash')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send(payCashPayload);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('transaksi tidak dapat dilakukan');
    expect(await ctx.paymentModel.countDocuments()).toBe(0);
    expect(await ctx.orderModel.countDocuments()).toBe(0);
  });

  it('DENY: frozen tenant cannot open a shift — 403 with its status label', async () => {
    await seedTenant('frozen');

    const res = await request(ctx.app)
      .post('/api/shifts/open')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ openingBalance: 100000 });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('dibekukan');
    expect(await ctx.shiftModel.countDocuments()).toBe(0);
  });

  it('DENY: expired active period cannot create an order — 403 before the service runs', async () => {
    await seedTenant('active', { subscriptionExpiresAt: new Date(Date.now() - 60_000) });

    const res = await request(ctx.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send(orderPayload);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Masa aktif toko telah berakhir');
    expect(await ctx.orderModel.countDocuments()).toBe(0);
  });

  it('ALLOW: active tenant takes payment normally', async () => {
    await seedTenant('active');

    const res = await request(ctx.app)
      .post('/api/payments/pay-cash')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send(payCashPayload);

    expect(res.status).toBe(200);
    expect(res.body.data.payment.amount).toBe(60000);
    expect(await ctx.paymentModel.countDocuments()).toBe(1);
  });

  it('ALLOW: reads stay open while suspended so the POS can render the refusal', async () => {
    await seedTenant('suspended');

    const res = await request(ctx.app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${ctx.token}`);

    expect(res.status).toBe(200);
  });

  it('ALLOW: a tenant with no document (platform super admin) is not blocked', async () => {
    const res = await request(ctx.app)
      .post('/api/payments/pay-cash')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send(payCashPayload);

    expect(res.status).toBe(200);
  });
});
