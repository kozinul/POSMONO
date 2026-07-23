import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose, { Model } from 'mongoose';
import express from 'express';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { generateTestToken } from '../helpers/auth';
import { OrderSchema } from '../../src/core/ordering/infrastructure/persistence/schemas/OrderSchema';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { ProductSchema } from '../../src/core/catalog/infrastructure/persistence/schemas/ProductSchema';
import { StockSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/StockSchema';
import { MongoOrderRepository } from '../../src/core/ordering/infrastructure/persistence/MongoOrderRepository';
import { MongoPaymentRepository } from '../../src/core/payment/infrastructure/persistence/MongoPaymentRepository';
import { MongoShiftRepository } from '../../src/core/pos/infrastructure/persistence/MongoShiftRepository';
import { MongoProductRepository } from '../../src/core/catalog/infrastructure/persistence/MongoProductRepository';
import { MongoStockRepository } from '../../src/core/inventory/infrastructure/persistence/MongoStockRepository';
import { CreateOrderService } from '../../src/core/ordering/application/services/OrderService';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { ProductService } from '../../src/core/catalog/application/services/ProductService';
import { InventoryService } from '../../src/core/inventory/application/services/InventoryService';
import { OrderController } from '../../src/core/ordering/interfaces/http/controllers/OrderController';
import { PaymentController } from '../../src/core/payment/interfaces/http/controllers/PaymentController';
import { ShiftController } from '../../src/core/pos/interfaces/http/controllers/ShiftController';
import { ProductController } from '../../src/core/catalog/interfaces/http/controllers/ProductController';
import { InventoryController } from '../../src/core/inventory/interfaces/http/controllers/InventoryController';
import { createOrderRoutes } from '../../src/core/ordering/interfaces/http/routes/order.routes';
import { createPaymentRoutes } from '../../src/core/payment/interfaces/http/routes/payment.routes';
import { createShiftRoutes } from '../../src/core/pos/interfaces/http/routes/shift.routes';
import { createProductRoutes } from '../../src/core/catalog/interfaces/http/routes/product.routes';
import { createInventoryRoutes } from '../../src/core/inventory/interfaces/http/routes/inventory.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { Order } from '../../src/core/ordering/domain/Order';
import { Shift } from '../../src/core/pos/domain/Shift';
import { Product } from '../../src/core/catalog/domain/Product';
import { Stock } from '../../src/core/inventory/domain/Stock';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const USER_A = 'user-a';
const USER_B = 'user-b';

describe('Integration: Tenant Isolation', () => {
  let app: express.Express;
  let tokenA: string;
  let tokenB: string;
  let orderModel: Model<any>;
  let paymentModel: Model<any>;
  let shiftModel: Model<any>;

  beforeAll(async () => {
    await setupTestDb();

    const eventBus = { publish: () => {} };

    orderModel = mongoose.model('Order', OrderSchema);
    paymentModel = mongoose.model('Payment', PaymentSchema);
    shiftModel = mongoose.model('Shift', ShiftSchema);
    const productModel = mongoose.model('Product', ProductSchema);
    const stockModel = mongoose.model('StockItem', StockSchema);

    const orderRepo = new MongoOrderRepository(orderModel);
    const paymentRepo = new MongoPaymentRepository(paymentModel);
    const shiftRepo = new MongoShiftRepository(shiftModel);
    const productRepo = new MongoProductRepository(productModel);
    const stockRepo = new MongoStockRepository(stockModel);
    const stockMovementRepo = { save: async () => {}, findByTenant: async () => ({ movements: [], total: 0 }) };

    const createOrderService = new CreateOrderService(orderRepo, eventBus);
    const taxService = {
      calculate: async (input: any) => {
        const subtotal = input.items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
        const discount = input.discount ?? 0;
        const isPercentage = input.discountType === 'percentage';
        const discountAmount = isPercentage
          ? Math.round(subtotal * Math.min(discount, 100) / 100)
          : Math.min(discount, subtotal);
        const taxableAmount = subtotal - discountAmount;
        const base = Math.round(taxableAmount * 11 / 12);
        const ppn = Math.round(base * 12 / 100);
        return {
          subtotal, discount, discountType: input.discountType ?? 'nominal', discountAmount,
          taxableAmount,
          taxes: [{ name: 'PPN 12%', type: 'vat', rate: 12, baseAmount: taxableAmount, amount: ppn, compoundOrder: 0 }],
          totalTax: ppn, serviceCharge: 0, grandTotal: taxableAmount + ppn, pricingMode: 'exclusive',
        };
      },
    };
    const paymentService = new PaymentService(paymentRepo, orderRepo, null as any, taxService as any, eventBus);
    const shiftService = new ShiftService(shiftRepo);
    const productService = new ProductService(productRepo);
    const inventoryService = new InventoryService(stockRepo, stockMovementRepo);

    const orderController = new OrderController(createOrderService, orderRepo);
    const paymentController = new PaymentController(paymentService);
    const shiftController = new ShiftController(shiftService);
    const productController = new ProductController(productService);
    const inventoryController = new InventoryController(inventoryService);

    tokenA = generateTestToken({ sub: USER_A, tenant: TENANT_A });
    tokenB = generateTestToken({ sub: USER_B, tenant: TENANT_B });

    app = express();
    app.use(express.json());
    app.use('/api/orders', createOrderRoutes(orderController));
    app.use('/api/payments', createPaymentRoutes(paymentController));
    app.use('/api/shifts', createShiftRoutes(shiftController));
    app.use('/api/products', createProductRoutes(productController));
    app.use('/api/inventory', createInventoryRoutes(inventoryController));
    app.use(errorHandler);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('Order isolation', () => {
    it('should not allow tenant B to access tenant A order', async () => {
      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          items: [{ productId: 'p1', productName: 'Item A', quantity: 1, unitPrice: 10000, totalPrice: 10000, modifiers: [], tax: { rate: 0, amount: 0 } }],
          notes: '',
          source: 'pos',
        });

      const orderId = createRes.body.data.id;

      const getRes = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.status).toBe(400);
    });

    it('should not show tenant B orders in tenant A list', async () => {
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          items: [{ productId: 'p1', productName: 'Item A', quantity: 1, unitPrice: 10000, totalPrice: 10000, modifiers: [], tax: { rate: 0, amount: 0 } }],
          notes: '',
          source: 'pos',
        });

      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          items: [{ productId: 'p2', productName: 'Item B', quantity: 1, unitPrice: 20000, totalPrice: 20000, modifiers: [], tax: { rate: 0, amount: 0 } }],
          notes: '',
          source: 'pos',
        });

      const listRes = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.meta.total).toBe(1);
    });
  });

  describe('Payment isolation', () => {
    it('should create payment scoped to tenant A', async () => {
      const payRes = await request(app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ items: [{ productId: 'p1', quantity: 1, unitPrice: 10000 }], amountPaid: 15000 });

      expect(payRes.status).toBe(200);
      const orderId = payRes.body.data.order.id;

      const getRes = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.status).toBe(400);
    });

    it('should not allow tenant B to see tenant A payment', async () => {
      const payRes = await request(app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ items: [{ productId: 'p1', quantity: 1, unitPrice: 10000 }], amountPaid: 15000 });

      const orderId = payRes.body.data.order.id;

      const listRes = await request(app)
        .get(`/api/payments/${orderId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(listRes.status).toBe(400);
    });
  });

  describe('Shift isolation', () => {
    it('should not allow tenant B to close tenant A shift', async () => {
      const openRes = await request(app)
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ registerId: 'reg-1', cashierId: USER_A, openingBalance: 0 });

      const shiftId = openRes.body.data.id;

      const closeRes = await request(app)
        .post(`/api/shifts/${shiftId}/close`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ expectedTotal: 0, actualTotal: 0 });

      expect(closeRes.status).toBe(404);
    });

    it('should not show tenant B shifts in tenant A list', async () => {
      await request(app)
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ registerId: 'reg-1', cashierId: USER_A, openingBalance: 0 });

      await request(app)
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ registerId: 'reg-2', cashierId: USER_B, openingBalance: 0 });

      const listRes = await request(app)
        .get('/api/shifts')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
    });

    it('should isolate getCurrent shift by tenant', async () => {
      await request(app)
        .post('/api/shifts/open')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ registerId: 'reg-1', cashierId: USER_A, openingBalance: 0 });

      const currentB = await request(app)
        .get('/api/shifts/current')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(currentB.body.data).toBeNull();
    });
  });

  describe('Product isolation', () => {
    it('should not allow tenant B to access tenant A product', async () => {
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ sku: 'SKU-A', name: 'Product A', categoryId: 'cat-1', basePrice: 10000 });

      const productId = createRes.body.data.id;

      const getRes = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.status).toBe(404);
    });

    it('should not show tenant B products in tenant A list', async () => {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ sku: 'SKU-A', name: 'Product A', categoryId: 'cat-1', basePrice: 10000 });

      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ sku: 'SKU-B', name: 'Product B', categoryId: 'cat-1', basePrice: 20000 });

      const listRes = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.meta.total).toBe(1);
    });
  });

  describe('Inventory isolation', () => {
    it('should not allow tenant B to access tenant A stock', async () => {
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ sku: 'SKU-STOCK', name: 'Stock Item', categoryId: 'cat-1', basePrice: 10000 });

      const productId = createRes.body.data.id;

      const stockInRes = await request(app)
        .post('/api/inventory/stock-in')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ productId, quantity: 50 });

      expect(stockInRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/inventory/${productId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.status).toBe(404);
    });

    it('should not show tenant B stock in tenant A low-stock list', async () => {
      const createResA = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ sku: 'SKU-LOW-A', name: 'Low Stock A', categoryId: 'cat-1', basePrice: 10000 });

      const createResB = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ sku: 'SKU-LOW-B1', name: 'Low Stock B', categoryId: 'cat-1', basePrice: 10000 });

      await request(app)
        .post('/api/inventory/stock-in')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ productId: createResA.body.data.id, quantity: 100 });

      await request(app)
        .post('/api/inventory/stock-in')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ productId: createResB.body.data.id, quantity: 2 });

      const lowStockRes = await request(app)
        .get('/api/inventory/low-stock')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(lowStockRes.status).toBe(200);
      expect(lowStockRes.body.data).toHaveLength(0);
    });
  });
});
