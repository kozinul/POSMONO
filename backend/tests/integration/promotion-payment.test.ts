import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Model } from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { buildIntegrationApp, IntegrationTestContext } from '../helpers/integration';
import { PromotionSchema } from '../../src/core/promotion/infrastructure/persistence/schemas/PromotionSchema';
import { MongoPromotionRepository } from '../../src/core/promotion/infrastructure/persistence/MongoPromotionRepository';
import { MongoDiscountConfigurationRepository } from '../../src/core/discount/infrastructure/persistence/MongoDiscountConfigurationRepository';
import { PromotionService } from '../../src/core/promotion/application/services/PromotionService';
import { DiscountServiceAdapter } from '../../src/core/discount/application/services/DiscountServiceAdapter';

const TENANT_ID = 'promotion-tenant';

const CART = [
  { productId: 'prod-1', categoryId: 'cat-1', quantity: 2, unitPrice: 25000 },
];

describe('Integration: Promotion → Discount → Payment', () => {
  let promotionModel: Model<any>;
  let promotionService: PromotionService;
  let discountService: DiscountServiceAdapter;

  beforeAll(async () => {
    await setupTestDb();
    promotionModel = mongoose.model('Promotion', PromotionSchema);
    const promotionRepo = new MongoPromotionRepository(promotionModel);
    const discountConfigRepo = new MongoDiscountConfigurationRepository();
    promotionService = new PromotionService(promotionRepo, discountConfigRepo);
    discountService = new DiscountServiceAdapter(discountConfigRepo);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  const applyDiscount = (items = CART, promoCode?: string) =>
    discountService.apply({ tenantId: TENANT_ID, items, promoCode });

  describe('percentage with min_purchase (baseline)', () => {
    it('ALLOW: memotong 10% dari subtotal', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Diskon 10%',
        rules: [{ type: 'min_purchase', params: { amount: 50000 } }],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      const result = await applyDiscount();

      expect(result.totalDiscount).toBe(5000);
      expect(result.appliedRules[0]?.ruleName).toBe('Diskon 10%');
    });

    it('DENY: tidak memotong bila minimum belanja tidak tercapai', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Diskon 10%',
        rules: [{ type: 'min_purchase', params: { amount: 50000 } }],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      const result = await applyDiscount([
        { productId: 'prod-1', categoryId: 'cat-1', quantity: 1, unitPrice: 10000 },
      ]);

      expect(result.totalDiscount).toBe(0);
    });
  });

  describe('date_range rule', () => {
    it('ALLOW: berlaku di dalam rentang tanggal', async () => {
      const today = new Date();
      const from = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
      const to = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Promo Tanggal',
        rules: [{ type: 'date_range', params: { from, to } }],
        effects: [{ type: 'percentage', value: 20, target: 'order' }],
      });

      const result = await applyDiscount();

      expect(result.totalDiscount).toBe(10000);
    });

    it('DENY: tidak berlaku di luar rentang tanggal', async () => {
      const from = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const to = new Date(Date.now() + 172800000).toISOString().slice(0, 10);

      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Promo Tanggal',
        rules: [{ type: 'date_range', params: { from, to } }],
        effects: [{ type: 'percentage', value: 20, target: 'order' }],
      });

      const result = await applyDiscount();

      expect(result.totalDiscount).toBe(0);
    });
  });

  describe('ruleLogic OR', () => {
    it('ALLOW: cukup satu rule yang cocok', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Promo OR',
        ruleLogic: 'OR',
        rules: [
          { type: 'min_purchase', params: { amount: 999999 } },
          { type: 'product_match', params: { productIds: ['prod-1'] } },
        ],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      const result = await applyDiscount();

      expect(result.totalDiscount).toBe(5000);
    });

    it('DENY: tidak ada rule yang cocok', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Promo OR',
        ruleLogic: 'OR',
        rules: [
          { type: 'min_purchase', params: { amount: 999999 } },
          { type: 'product_match', params: { productIds: ['prod-9'] } },
        ],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      const result = await applyDiscount();

      expect(result.totalDiscount).toBe(0);
    });
  });

  describe('product_match / category_match rules', () => {
    it('ALLOW: produk yang dipilih ada di keranjang', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Produk Tertentu',
        rules: [{ type: 'product_match', params: { productIds: ['prod-1'] } }],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      const result = await applyDiscount();

      expect(result.totalDiscount).toBe(5000);
    });

    it('DENY: produk yang dipilih tidak ada di keranjang', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Produk Tertentu',
        rules: [{ type: 'product_match', params: { productIds: ['prod-9'] } }],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      const result = await applyDiscount();

      expect(result.totalDiscount).toBe(0);
    });

    it('ALLOW: kategori yang dipilih ada di keranjang', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Kategori Tertentu',
        rules: [{ type: 'category_match', params: { categoryIds: ['cat-1'] } }],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      const result = await applyDiscount();

      expect(result.totalDiscount).toBe(5000);
    });
  });

  describe('buy_x_pay_y effect', () => {
    it('ALLOW: satu item termurah menjadi gratis saat beli 3 bayar 2', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Beli 3 Bayar 2',
        rules: [{ type: 'min_items', params: { count: 3 } }],
        effects: [
          {
            type: 'buy_x_pay_y',
            value: 0,
            target: 'order',
            params: { buyQuantity: 3, payQuantity: 2, allocationStrategy: 'cheapest' },
          },
        ],
      });

      const result = await applyDiscount([
        { productId: 'prod-1', categoryId: 'cat-1', quantity: 3, unitPrice: 25000 },
      ]);

      // The value comes off as a free unit, not as a cash discount — the two are
      // reported separately so the till can charge what the counter quoted.
      expect(result.totalDiscount).toBe(0);
      expect(result.freeItemValue).toBe(25000);
      expect(result.freeItems).toEqual([{ productId: 'prod-1', quantity: 1 }]);
      expect(result.appliedRules[0]?.freeItemValue).toBe(25000);
    });
  });

  describe('free_item effect (item termurah)', () => {
    it('ALLOW: item termurah menjadi gratis', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Gratis Item Termurah',
        rules: [{ type: 'min_purchase', params: { amount: 25000 } }],
        effects: [{ type: 'free_item', value: 0, target: 'cheapest_item', params: { quantity: 1 } }],
      });

      const result = await applyDiscount([
        { productId: 'prod-1', categoryId: 'cat-1', quantity: 1, unitPrice: 25000 },
        { productId: 'prod-2', categoryId: 'cat-1', quantity: 1, unitPrice: 15000 },
      ]);

      expect(result.freeItemValue).toBe(15000);
      expect(result.freeItems[0]?.productId).toBe('prod-2');
    });

    it('ALLOW: item termurah dibatasi pada produk yang cocok promo', async () => {
      // prod-3 paling murah di keranjang tapi tidak termasuk promo — barang
      // termurah yang dicari adalah termurah di antara produk yang cocok.
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Gratis Item Termurah',
        rules: [{ type: 'product_match', params: { productIds: ['prod-2'] } }],
        effects: [{ type: 'free_item', value: 0, target: 'cheapest_item', params: { quantity: 1 } }],
      });

      const result = await applyDiscount([
        { productId: 'prod-1', categoryId: 'cat-1', quantity: 1, unitPrice: 25000 },
        { productId: 'prod-2', categoryId: 'cat-1', quantity: 1, unitPrice: 15000 },
        { productId: 'prod-3', categoryId: 'cat-1', quantity: 1, unitPrice: 5000 },
      ]);

      expect(result.freeItems[0]?.productId).toBe('prod-2');
      expect(result.freeItemValue).toBe(15000);
    });

    it('ALLOW: satu unit gratis, bukan seluruh produk yang cocok', async () => {
      // Tiga prod-1 di keranjang + promo "gratis item termurah" untuk prod-1:
      // tiga unit yang cocok bukan berarti tiga unit gratis.
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Gratis Item Termurah',
        rules: [{ type: 'product_match', params: { productIds: ['prod-1'] } }],
        effects: [{ type: 'free_item', value: 0, target: 'cheapest_item', params: { quantity: 1 } }],
      });

      const result = await applyDiscount([
        { productId: 'prod-1', categoryId: 'cat-1', quantity: 3, unitPrice: 25000 },
      ]);

      expect(result.freeItems).toEqual([{ productId: 'prod-1', quantity: 1 }]);
      expect(result.freeItemValue).toBe(25000);
    });

    it('ALLOW: unit gratis diambil dari baris termurah saat produk sama muncul dua kali', async () => {
      // Produk sama, modifier berbeda → dua baris dengan harga berbeda.
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Gratis Item Termurah',
        rules: [{ type: 'min_purchase', params: { amount: 25000 } }],
        effects: [{ type: 'free_item', value: 0, target: 'cheapest_item', params: { quantity: 1 } }],
      });

      const result = await applyDiscount([
        { productId: 'prod-1', categoryId: 'cat-1', quantity: 1, unitPrice: 25000 },
        { productId: 'prod-1', categoryId: 'cat-1', quantity: 1, unitPrice: 15000 },
      ]);

      expect(result.freeItemValue).toBe(15000);
    });
  });

  describe('kode promo', () => {
    it('ALLOW: kode promo huruf kecil tetap berlaku', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Promo Kode',
        code: 'DISC10',
        rules: [],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      const result = await applyDiscount(CART, 'disc10');

      expect(result.totalDiscount).toBe(5000);
    });

    it('DENY: kode promo lain tidak berlaku', async () => {
      await promotionService.create({
        tenantId: TENANT_ID,
        name: 'Promo Kode',
        code: 'DISC10',
        rules: [],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      const result = await applyDiscount(CART, 'LAIN');

      expect(result.totalDiscount).toBe(0);
    });
  });

  describe('pembayaran (HTTP)', () => {
    let ctx: IntegrationTestContext;

    beforeAll(async () => {
      ctx = await buildIntegrationApp({ permissions: ['orders:read'] });
    });

    beforeEach(async () => {
      await clearCollections();
      await ctx.productModel.create({
        _id: 'prod-1',
        tenantId: ctx.tenantId,
        sku: 'SKU-1',
        name: 'Produk A',
        categoryId: 'cat-1',
        basePrice: 25000,
      });
    });

    const createPromotion = (input: {
      name: string;
      rules?: any[];
      effects: any[];
      code?: string;
      ruleLogic?: 'AND' | 'OR';
    }) =>
      new PromotionService(
        new MongoPromotionRepository(promotionModel),
        new MongoDiscountConfigurationRepository(),
      ).create({
        tenantId: ctx.tenantId,
        name: input.name,
        code: input.code,
        ruleLogic: input.ruleLogic,
        rules: input.rules ?? [],
        effects: input.effects,
      });

    it('ALLOW: diskon promotion ikut terpotong di pembayaran', async () => {
      await createPromotion({
        name: 'Diskon 10%',
        rules: [{ type: 'min_purchase', params: { amount: 50000 } }],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({
          items: [{ productId: 'prod-1', quantity: 2, unitPrice: 25000 }],
          amountPaid: 60000,
        });

      expect(payRes.status).toBe(200);
      // subtotal 50.000 - diskon 5.000 = 45.000 + PPN 12% (dpp 11/12)
      expect(payRes.body.data.order.subtotal).toBe(50000);
      expect(payRes.body.data.order.discount).toBe(5000);
    });

    it('ALLOW: promo gratis tidak menambah tagihan di atas nominal yang offer', async () => {
      // "Beli 3 bayar 2" — 3 unit 25.000, satu unit gratis.
      await createPromotion({
        name: 'Beli 3 Bayar 2',
        rules: [{ type: 'min_items', params: { count: 3 } }],
        effects: [
          {
            type: 'buy_x_pay_y',
            value: 0,
            target: 'order',
            params: { buyQuantity: 3, payQuantity: 2, allocationStrategy: 'cheapest' },
          },
        ],
      });

      // The counter quotes 50.000 + PPN 12% (dpp 11/12 → 5.500) = 55.500.
      // The client sends the paid lines and the free line separately, exactly
      // like the POS store does.
      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({
          items: [
            { productId: 'prod-1', productName: 'Produk A', quantity: 2, unitPrice: 25000 },
            { productId: 'prod-1', productName: 'Produk A', quantity: 1, unitPrice: 0, isFreeItem: true },
          ],
          amountPaid: 55500,
        });

      expect(payRes.status).toBe(200);
      const order = payRes.body.data.order;
      expect(order.subtotal).toBe(75000);
      expect(order.discount).toBe(25000);
      expect(order.total).toBe(55500);
      // The free unit is stored as a free line, not as a cash discount.
      expect(order.discountBreakdown[0]?.amount).toBe(25000);
      expect(order.items.find((i: any) => i.isFreeItem)?.quantity).toBe(1);
    });

    it('DENY: nominal yang lebih kecil dari offer ditolak, bukan dipotong diam-diam', async () => {
      await createPromotion({
        name: 'Beli 3 Bayar 2',
        rules: [{ type: 'min_items', params: { count: 3 } }],
        effects: [
          {
            type: 'buy_x_pay_y',
            value: 0,
            target: 'order',
            params: { buyQuantity: 3, payQuantity: 2, allocationStrategy: 'cheapest' },
          },
        ],
      });

      const payRes = await request(ctx.app)
        .post('/api/payments/pay-cash')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({
          items: [
            { productId: 'prod-1', productName: 'Produk A', quantity: 2, unitPrice: 25000 },
            { productId: 'prod-1', productName: 'Produk A', quantity: 1, unitPrice: 0, isFreeItem: true },
          ],
          amountPaid: 50000,
        });

      expect(payRes.status).toBe(400);
      expect(payRes.body.error?.message).toMatch(/Kurang|Insufficient/i);
    });
  });
});
