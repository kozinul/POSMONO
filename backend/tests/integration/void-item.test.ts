import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { buildIntegrationApp, IntegrationTestContext } from '../helpers/integration';

describe('Void Item Integration Test', () => {
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

  it('should void an item from an order', async () => {
    const createRes = await request(ctx.app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        items: [
          { productId: 'p1', productName: 'Item A', quantity: 2, unitPrice: 10000, totalPrice: 20000, variantId: null, modifiers: [], tax: { rate: 0, amount: 0 } },
          { productId: 'p2', productName: 'Item B', quantity: 1, unitPrice: 15000, totalPrice: 15000, variantId: null, modifiers: [], tax: { rate: 0, amount: 0 } },
        ],
        source: 'pos',
      });

    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.id;
    console.log('Created order:', JSON.stringify(createRes.body.data, null, 2));

    const voidRes = await request(ctx.app)
      .post(`/api/orders/${orderId}/void-item`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        itemIndex: 0,
        reason: 'Customer changed mind',
        voidedByName: 'Cashier Test',
      });

    console.log('Void response status:', voidRes.status);
    console.log('Void response body:', JSON.stringify(voidRes.body, null, 2));
    
    // Print the error if it exists
    if (voidRes.body.error) {
      console.log('Error details:', JSON.stringify(voidRes.body.error, null, 2));
    }
    expect(voidRes.status).toBe(200);
  });
});
