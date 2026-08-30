import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { buildIntegrationApp, IntegrationTestContext } from '../helpers/integration';
import { generateTestToken } from '../helpers/auth';

const PERMS = ['products:write', 'products:read', 'inventory:write', 'inventory:read'];

function invoiceTemplateDoc(tenantId: string) {
  return {
    _id: `tpl-${tenantId}-invoice`,
    tenantId,
    name: 'Standard Invoice A4',
    description: 'Standard A4 invoice for E2E',
    schemaVersion: 1,
    documentType: 'invoice',
    paper: { type: 'a4-portrait', width: 210, height: 297, margin: { top: 15, right: 15, bottom: 15, left: 15 } },
    sections: [
      { id: 'sec-header', type: 'header', enabled: true, order: 1, nodes: [
        { id: 'n1', type: 'field', field: 'store.name', style: { font: { size: 18, weight: 'bold', align: 'center' } } },
      ]},
      { id: 'sec-invoice', type: 'order_info', enabled: true, order: 2, nodes: [
        { id: 'n2', type: 'field', field: 'order.documentNumber', label: 'Invoice', style: {} },
      ]},
      { id: 'sec-items', type: 'items', enabled: true, order: 3, nodes: [
        { id: 'n3', type: 'table', dataSource: 'items', columns: [
          { field: 'name', header: 'Item', align: 'left' },
          { field: 'qty', header: 'Qty', align: 'right' },
          { field: 'totalPrice', header: 'Total', align: 'right', format: 'number(0)' },
        ]},
      ]},
      { id: 'sec-summary', type: 'summary', enabled: true, order: 4, nodes: [
        { id: 'n4', type: 'field', field: 'summary.grandTotal', label: 'Grand Total', format: 'number(0)', style: {} },
      ]},
      { id: 'sec-footer', type: 'footer', enabled: true, order: 5, nodes: [
        { id: 'n5', type: 'text', text: 'Thank you for your business!', style: {} },
      ]},
    ],
    metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, createdBy: 'system' },
    isActive: true,
    isDefault: true,
  };
}

describe('E2E Critical Path Flows', () => {
  let ctx: IntegrationTestContext;

  beforeAll(async () => {
    await setupTestDb();
    ctx = await buildIntegrationApp({ enforceShift: true, permissions: PERMS });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
    await ctx.tenantModel.create({
      _id: ctx.tenantId,
      name: 'Toko E2E',
      slug: 'toko-e2e',
      ownerId: ctx.userId,
      businessType: 'retail',
      databaseName: 'posmono',
      billingEmail: 'e2e@test.local',
    });
    await ctx.templateModel.create(invoiceTemplateDoc(ctx.tenantId));
  });

  const auth = () => `Bearer ${ctx.token}`;

  async function createProduct(sku = 'SKU-1', name = 'Produk A', basePrice = 25000) {
    const res = await request(ctx.app)
      .post('/api/products')
      .set('Authorization', auth())
      .send({ sku, name, categoryId: 'cat-1', basePrice });
    expect(res.status).toBe(201);
    return res.body.data;
  }

  async function stockIn(productId: string, quantity: number) {
    const res = await request(ctx.app)
      .post('/api/inventory/stock-in')
      .set('Authorization', auth())
      .send({ productId, quantity });
    expect(res.status).toBe(200);
    return res.body.data;
  }

  async function openShift(openingBalance = 100000) {
    const res = await request(ctx.app)
      .post('/api/shifts/open')
      .set('Authorization', auth())
      .send({ openingBalance });
    expect(res.status).toBe(201);
    return res.body.data;
  }

  async function closeShift(shiftId: string, physicalCash: number) {
    const res = await request(ctx.app)
      .post(`/api/shifts/${shiftId}/close`)
      .set('Authorization', auth())
      .send({ physicalCash });
    expect(res.status).toBe(200);
    return res.body.data;
  }

  it('money loop: open shift → sale → pay cash → stock decrement → invoice → close shift', async () => {
    const shift = await openShift(100000);
    const product = await createProduct();
    await stockIn(product.id, 50);

    const payRes = await request(ctx.app)
      .post('/api/payments/pay-cash')
      .set('Authorization', auth())
      .send({ items: [{ productId: product.id, quantity: 2, unitPrice: 25000 }], amountPaid: 60000, shiftId: shift.id });

    expect(payRes.status).toBe(200);
    const order = payRes.body.data.order;
    const payment = payRes.body.data.payment;

    expect(order.status).toBe('paid');
    expect(order.subtotal).toBe(50000);
    expect(order.total).toBe(55500);
    expect(order.roundingAdjustment).toBe(0);
    expect(order.paymentBreakdown).toHaveLength(1);
    expect(order.paymentBreakdown[0].method).toBe('cash');
    expect(order.paymentBreakdown[0].amount).toBe(60000);
    expect(payment.change).toBe(4500);
    expect(payment.method).toBe('cash');
    expect(payment.shiftId).toBe(shift.id);

    const inv = await request(ctx.app)
      .get(`/api/inventory/${product.id}`)
      .set('Authorization', auth());
    expect(inv.status).toBe(200);
    expect(inv.body.data.quantity).toBe(48);
    expect(inv.body.data.availableQuantity).toBe(48);

    const invoiceRes = await request(ctx.app)
      .get(`/api/orders/${order.id}/invoice`)
      .set('Authorization', auth());
    expect(invoiceRes.status).toBe(200);
    expect(invoiceRes.body.data.templateName).toBe('Standard Invoice A4');
    expect(invoiceRes.body.data.invoiceNumber).toMatch(/^INV-/);
    expect(typeof invoiceRes.body.data.pdf).toBe('string');
    expect(invoiceRes.body.data.pdf.length).toBeGreaterThan(100);

    const closed = await closeShift(shift.id, 155500);
    expect(closed.status).toBe('closed');
    // harness ShiftService has no reportAggregation → shift sales stay 0 (production wires it)
    expect(closed.expectedCash).toBe(100000);
    expect(closed.expectedTotal).toBe(100000);
    expect(closed.actualTotal).toBe(155500);
  });

  it('rejects POS sale when no shift is open', async () => {
    const res = await request(ctx.app)
      .post('/api/payments/pay-cash')
      .set('Authorization', auth())
      .send({ items: [{ productId: 'prod-1', quantity: 1, unitPrice: 10000 }], amountPaid: 10000 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Buka shift/);
  });

  it('carried-over held bill: hold → close shift → pay next shift → close-bill cleanup', async () => {
    const shiftA = await openShift(200000);
    const product = await createProduct('SKU-HELD', 'Produk Held', 10000);
    await stockIn(product.id, 20);

    const createRes = await request(ctx.app)
      .post('/api/orders')
      .set('Authorization', auth())
      .send({
        items: [{ productId: product.id, productName: 'Produk Held', quantity: 3, unitPrice: 10000, totalPrice: 30000, variantId: null, modifiers: [], tax: { rate: 0, amount: 0 } }],
        source: 'pos',
      });
    expect(createRes.status).toBe(201);
    const heldOrderId = createRes.body.data.id;

    const holdRes = await request(ctx.app)
      .post(`/api/orders/${heldOrderId}/hold`)
      .set('Authorization', auth())
      .send({});
    expect(holdRes.status).toBe(200);
    expect(holdRes.body.data.status).toBe('held');

    const closedA = await closeShift(shiftA.id, 200000);
    expect(closedA.status).toBe('closed');
    expect(closedA.carriedOverBills).toHaveLength(1);
    expect(closedA.carriedOverBills[0].orderNumber).toMatch(/^ORD-/);

    const shiftB = await openShift(300000);

    const carried = await request(ctx.app)
      .get('/api/shifts/carried-bills')
      .set('Authorization', auth());
    expect(carried.status).toBe(200);
    expect(carried.body.data.count).toBe(1);
    expect(carried.body.data.bills[0].orderNumber).toMatch(/^ORD-/);

    const payHeld = await request(ctx.app)
      .post('/api/payments/pay-cash')
      .set('Authorization', auth())
      .send({ items: [{ productId: product.id, quantity: 3, unitPrice: 10000 }], amountPaid: 34000 });
    expect(payHeld.status).toBe(200);
    expect(payHeld.body.data.order.status).toBe('paid');

    const closeBillRes = await request(ctx.app)
      .post(`/api/orders/${heldOrderId}/close-bill`)
      .set('Authorization', auth())
      .send({});
    expect(closeBillRes.status).toBe(200);
    expect(closeBillRes.body.data.status).toBe('cancelled');

    const carriedAfter = await request(ctx.app)
      .get('/api/shifts/carried-bills')
      .set('Authorization', auth());
    expect(carriedAfter.status).toBe(200);
    expect(carriedAfter.body.data.count).toBe(0);

    const inv = await request(ctx.app)
      .get(`/api/inventory/${product.id}`)
      .set('Authorization', auth());
    expect(inv.body.data.quantity).toBe(17);
  });

  it('void paid order restores stock', async () => {
    await openShift(50000);
    const product = await createProduct('SKU-VOID', 'Produk Void', 10000);
    await stockIn(product.id, 10);

    const payRes = await request(ctx.app)
      .post('/api/payments/pay-cash')
      .set('Authorization', auth())
      .send({ items: [{ productId: product.id, quantity: 4, unitPrice: 10000 }], amountPaid: 50000 });
    expect(payRes.status).toBe(200);
    const orderId = payRes.body.data.order.id;

    const lowInv = await request(ctx.app)
      .get(`/api/inventory/${product.id}`)
      .set('Authorization', auth());
    expect(lowInv.body.data.quantity).toBe(6);

    const voidRes = await request(ctx.app)
      .post(`/api/orders/${orderId}/void`)
      .set('Authorization', auth())
      .send({ reason: 'Pesanan dibatalkan pelanggan', voidedByName: 'Kasir E2E' });
    expect(voidRes.status).toBe(200);
    expect(voidRes.body.data.status).toBe('voided');

    const restoredInv = await request(ctx.app)
      .get(`/api/inventory/${product.id}`)
      .set('Authorization', auth());
    expect(restoredInv.body.data.quantity).toBe(10);
  });

  it('tenant isolation: other tenant cannot read order, shift, product or stock', async () => {
    await openShift(10000);
    const product = await createProduct('SKU-ISO', 'Produk ISO', 10000);
    await stockIn(product.id, 15);

    const payRes = await request(ctx.app)
      .post('/api/payments/pay-cash')
      .set('Authorization', auth())
      .send({ items: [{ productId: product.id, quantity: 1, unitPrice: 10000 }], amountPaid: 20000 });
    const orderId = payRes.body.data.order.id;

    const otherToken = generateTestToken({ sub: 'user-other', tenant: 'other-tenant', permissions: PERMS });

    const orderRead = await request(ctx.app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(orderRead.status).toBe(400);

    const productRead = await request(ctx.app)
      .get(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(productRead.status).toBe(404);

    const stockRead = await request(ctx.app)
      .get(`/api/inventory/${product.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(stockRead.status).toBe(404);

    const shiftCurrent = await request(ctx.app)
      .get('/api/shifts/current')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(shiftCurrent.body.data).toBeNull();

    const orderList = await request(ctx.app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(orderList.body.data).toHaveLength(0);
  });
});