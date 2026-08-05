import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePOSStore } from '../../src/core/pos/store/posStore';

// Mock the backend pricing API. Simulates "beli 3 dapat 1 gratis"
// (same_product) so the free-item reconciliation can be exercised in the store.
const mockPricing = vi.fn();
vi.mock('../../src/@shared/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPricing(...args),
    get: () => Promise.resolve({ data: { data: [] } }),
    put: () => Promise.resolve({ data: { data: {} } }),
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
    defaults: {},
  },
}));

function freeLineItem(productId: string, productName: string, categoryId: string, quantity: number) {
  return {
    productId,
    productName,
    categoryId,
    quantity,
    unitPrice: 0,
    originalUnitPrice: 10000,
    discount: 10000 * quantity,
    lineTotal: 0,
    isFreeItem: true,
    freeByRuleId: 'r1',
  };
}

function paidLineItem(productId: string, productName: string, categoryId: string, quantity: number, unitPrice: number, discount = 0) {
  return {
    productId,
    productName,
    categoryId,
    quantity,
    unitPrice,
    originalUnitPrice: unitPrice,
    discount,
    lineTotal: unitPrice * quantity - discount,
    isFreeItem: false,
  };
}

// buy = 3, get = 1: 1 free per every 3 units of the same product.
function pricingForBuy3Get1(items: Array<{ productId: string; productName: string; categoryId: string; quantity: number; unitPrice: number }>) {
  const lineItems = [];
  for (const it of items) {
    const freeQty = Math.floor(it.quantity / 3);
    const paidQty = it.quantity - freeQty;
    if (paidQty > 0) lineItems.push(paidLineItem(it.productId, it.productName, it.categoryId, paidQty, it.unitPrice));
    if (freeQty > 0) lineItems.push(freeLineItem(it.productId, it.productName, it.categoryId, freeQty));
  }
  const originalSubtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const promotionDiscount = items.reduce((s, i) => s + Math.floor(i.quantity / 3) * i.unitPrice, 0);
  return { data: { lineItems, originalSubtotal, promotionDiscount, netSubtotal: originalSubtotal - promotionDiscount, grandTotal: originalSubtotal - promotionDiscount } };
}

describe('POS Store (free-item cart flow)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    usePOSStore.setState({
      items: [], pricing: null, pricingLoading: false, promoCode: '', manualDiscount: 0, manualDiscountType: 'nominal',
      discountRules: [], productPrices: {}, paymentModalOpen: false, paymentState: 'idle',
      receipt: null, customerName: '', tableNumber: '', heldOrders: [], heldOrdersPanelOpen: false,
      dismissedHeldOrderIds: [], activeBillId: null, activeBillNumber: null, splitNumber: 0, splitBaseOrderNumber: null,
    } as any);
    mockPricing.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const coffee = { productId: 'coffee', name: 'Kopi', price: 10000, categoryId: 'drink', imageUrl: '' };

  it('addItem increments paid quantity', () => {
    usePOSStore.getState().addItem(coffee);
    usePOSStore.getState().addItem(coffee);

    const items = usePOSStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
    expect(items[0].isFreeItem).toBe(undefined);
  });

  it('beli 3 dapat 1: 3 adds -> 2 paid + 1 free', async () => {
    mockPricing.mockImplementation((_url: string, body: { items: Array<{ productId: string; productName: string; categoryId: string; quantity: number; unitPrice: number }> }) => {
      if (body && body.items) return Promise.resolve(pricingForBuy3Get1(body.items));
      return Promise.resolve({ data: {} });
    });

    const store = usePOSStore.getState();
    store.addItem(coffee);
    store.addItem(coffee);
    store.addItem(coffee);

    vi.advanceTimersByTime(60);
    await vi.waitFor(() => {
      const items = usePOSStore.getState().items;
      expect(items.filter((i: any) => i.isFreeItem).length).toBeGreaterThanOrEqual(1);
    });

    const items = usePOSStore.getState().items;
    const paid = items.filter((i) => !i.isFreeItem);
    const free = items.filter((i) => i.isFreeItem);
    expect(paid).toHaveLength(1);
    expect(paid[0].quantity).toBe(2);
    expect(free).toHaveLength(1);
    expect(free[0].quantity).toBe(1);
    expect(free[0].price).toBe(0);
  });

  it('beli 3 dapat 1: 6 adds -> 4 paid + 2 free (order GROWS, not stuck at 1)', async () => {
    mockPricing.mockImplementation((_url: string, body: { items: Array<{ productId: string; productName: string; categoryId: string; quantity: number; unitPrice: number }> }) => {
      if (body && body.items) return Promise.resolve(pricingForBuy3Get1(body.items));
      return Promise.resolve({ data: {} });
    });

    const store = usePOSStore.getState();
    for (let i = 0; i < 6; i++) {
      store.addItem(coffee);
      vi.advanceTimersByTime(60);
      for (let f = 0; f < 10; f++) await Promise.resolve();
    }

    const items = usePOSStore.getState().items;
    const paid = items.filter((i) => !i.isFreeItem);
    const free = items.filter((i) => i.isFreeItem);
    expect(paid[0].quantity).toBe(4);
    expect(free[0].quantity).toBe(2);
  });
});
