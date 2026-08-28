import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePOSStore, EMPTY_SHIFT_TOTALS } from '../../src/core/pos/store/posStore';

// Mock the backend pricing API. Simulates "beli 3 dapat 1 gratis"
// (same_product) so the free-item reconciliation can be exercised in the store.
const mockPricing = vi.fn();
const mockShiftSales = vi.fn();
vi.mock('../../src/@shared/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPricing(...args),
    get: () => Promise.resolve({ data: { data: [] } }),
    put: (...args: unknown[]) => mockShiftSales(...args),
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
    defaults: {},
  },
}));
vi.mock('../../src/@shared/hooks/useToast', () => ({
  toast: () => {},
}));

mockShiftSales.mockResolvedValue({ data: { data: {} } });

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
      openShiftId: null, shiftTotals: { ...EMPTY_SHIFT_TOTALS },
    } as any);
    mockPricing.mockReset();
    mockShiftSales.mockClear();
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

  it('seedOpenShift loads baseline totals for the open shift', () => {
    usePOSStore.getState().seedOpenShift({
      id: 'shift-1',
      totalSales: 10000,
      cashSales: 10000,
      nonCashSales: 0,
      totalTransactions: 1,
      paymentBreakdown: [{ method: 'cash', code: 'cash', amount: 10000 }],
    });

    const state = usePOSStore.getState();
    expect(state.openShiftId).toBe('shift-1');
    expect(state.shiftTotals.totalSales).toBe(10000);
    expect(state.shiftTotals.totalTransactions).toBe(1);
  });

  it('seedOpenShift keeps local accumulator for the same shift (refetch does not reset)', () => {
    usePOSStore.getState().seedOpenShift({
      id: 'shift-1', totalSales: 0, cashSales: 0, nonCashSales: 0, totalTransactions: 0, paymentBreakdown: [],
    });
    usePOSStore.getState().registerShiftPayment({ total: 10000, method: 'cash', isCash: true });

    usePOSStore.getState().seedOpenShift({
      id: 'shift-1', totalSales: 0, cashSales: 0, nonCashSales: 0, totalTransactions: 0, paymentBreakdown: [],
    });

    expect(usePOSStore.getState().shiftTotals.totalSales).toBe(10000);
  });

  it('registerShiftPayment accumulates totals and PUTs to /shifts/:id/sales', () => {
    usePOSStore.getState().seedOpenShift({
      id: 'shift-1',
      totalSales: 10000,
      cashSales: 10000,
      nonCashSales: 0,
      totalTransactions: 1,
      paymentBreakdown: [{ method: 'cash', code: 'cash', amount: 10000 }],
    });

    const store = usePOSStore.getState();
    store.registerShiftPayment({ total: 20000, method: 'cash', isCash: true });
    store.registerShiftPayment({ total: 15000, method: 'qris', isCash: false });

    const totals = usePOSStore.getState().shiftTotals;
    expect(totals.totalSales).toBe(45000);
    expect(totals.cashSales).toBe(30000);
    expect(totals.nonCashSales).toBe(15000);
    expect(totals.totalTransactions).toBe(3);
    expect(totals.paymentBreakdown).toEqual([
      { method: 'cash', code: 'cash', amount: 30000 },
      { method: 'qris', code: 'qris', amount: 15000 },
    ]);

    expect(mockShiftSales).toHaveBeenLastCalledWith('/shifts/shift-1/sales', {
      totalSales: 45000,
      cashSales: 30000,
      nonCashSales: 15000,
      totalTransactions: 3,
      paymentBreakdown: [
        { method: 'cash', code: 'cash', amount: 30000 },
        { method: 'qris', code: 'qris', amount: 15000 },
      ],
    });
  });

  it('registerShiftPayment is a no-op without an open shift', () => {
    usePOSStore.getState().registerShiftPayment({ total: 20000, method: 'cash', isCash: true });

    const totals = usePOSStore.getState().shiftTotals;
    expect(totals.totalSales).toBe(0);
    expect(totals.totalTransactions).toBe(0);
    expect(mockShiftSales).not.toHaveBeenCalled();
  });

  it('registerSplitPayment falls back to the given base order number (no active bill)', () => {
    usePOSStore.getState().registerSplitPayment('ORD-100');

    const state = usePOSStore.getState();
    expect(state.splitNumber).toBe(1);
    expect(state.splitBaseOrderNumber).toBe('ORD-100');
  });

  it('registerSplitPayment prefers activeBillNumber over the given base', () => {
    usePOSStore.setState({ activeBillNumber: 'ORD-BILL' } as any);
    usePOSStore.getState().registerSplitPayment('ORD-100');

    const state = usePOSStore.getState();
    expect(state.splitNumber).toBe(1);
    expect(state.splitBaseOrderNumber).toBe('ORD-BILL');
  });

  it('registerSplitPayment keeps the existing split base for continuation portions', () => {
    usePOSStore.setState({ splitNumber: 1, splitBaseOrderNumber: 'ORD-100' } as any);
    usePOSStore.getState().registerSplitPayment('ORD-200');

    const state = usePOSStore.getState();
    expect(state.splitNumber).toBe(2);
    expect(state.splitBaseOrderNumber).toBe('ORD-100');
  });

  it('closeBillAfterPayment resets split state even without an active bill', async () => {
    usePOSStore.setState({ splitNumber: 1, splitBaseOrderNumber: 'ORD-100' } as any);
    await usePOSStore.getState().closeBillAfterPayment();

    const state = usePOSStore.getState();
    expect(state.splitNumber).toBe(0);
    expect(state.splitBaseOrderNumber).toBeNull();
  });
});
