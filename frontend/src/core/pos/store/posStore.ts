import { create } from 'zustand';
import type { ITaxConfiguration } from '../../../@shared/hooks/useTaxConfiguration';
import type { IDiscountRule, IDiscountResult } from '../../../@shared/hooks/useDiscountConfiguration';
import { calculateTax, type TaxCalcResult, type TaxBreakdownItem } from '../../../@shared/utils/taxCalculator';
import { calculateDiscount } from '../../../@shared/utils/discountCalculator';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  notes?: string;
  categoryId?: string;
  pricingProfileId?: string;
  pricingMode?: 'inclusive' | 'exclusive';
}

export type PaymentState = 'idle' | 'processing' | 'success' | 'error';

interface HeldOrder {
  id: string;
  orderNumber: string;
  items: CartItem[];
  total: number;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  customerName: string;
  tableNumber: string;
  createdAt: string;
}

interface Receipt {
  orderNumber: string;
  displayOrderNumber: string;
  paid: number;
  change: number;
  taxBreakdown: TaxCalcResult['taxBreakdown'];
  totalTax: number;
  serviceCharge: number;
  grandTotal: number;
  paidItems: CartItem[];
  hasRemaining: boolean;
}

interface POSState {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  serviceCharge: number;
  serviceChargeName: string;
  tax: number;
  taxName: string;
  taxBreakdown: TaxCalcResult['taxBreakdown'];
  displayBreakdown: TaxBreakdownItem[];
  inclusiveTax: number;
  discount: number;
  discountType: 'percentage' | 'nominal';
  discountAmount: number;
  promoCode: string;
  promoApplied: IDiscountResult | null;
  discountRules: IDiscountRule[];
  total: number;

  paymentModalOpen: boolean;
  paymentState: PaymentState;
  receipt: Receipt | null;
  taxConfig: ITaxConfiguration | null;

  customerName: string;
  tableNumber: string;

  heldOrders: HeldOrder[];
  heldOrdersPanelOpen: boolean;

  splitNumber: number;
  splitBaseOrderNumber: string | null;

  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  setItemNotes: (productId: string, notes: string) => void;
  setDiscount: (value: number, type: 'percentage' | 'nominal') => void;
  setPromoCode: (code: string) => void;
  setDiscountRules: (rules: IDiscountRule[]) => void;
  clearCart: () => void;
  setTaxConfig: (config: ITaxConfiguration) => void;
  setCustomerName: (name: string) => void;
  setTableNumber: (table: string) => void;

  openPaymentModal: () => void;
  closePaymentModal: () => void;
  setPaymentState: (state: PaymentState) => void;
  setReceipt: (receipt: Omit<Receipt, 'taxBreakdown' | 'totalTax' | 'serviceCharge' | 'grandTotal'>) => void;
  clearReceipt: () => void;

  holdOrder: () => Promise<void>;
  recallOrder: (heldOrder: HeldOrder) => void;
  dismissHeldOrder: (orderId: string) => void;
  loadHeldOrders: (tenantId: string) => Promise<void>;
  toggleHeldOrdersPanel: () => void;

  removeItems: (productIds: string[]) => void;
  resetSplit: () => void;
}

function derive(
  items: CartItem[],
  discount: number,
  discountType: 'percentage' | 'nominal',
  taxConfig: ITaxConfiguration | null,
  discountRules?: IDiscountRule[],
  promoCode?: string,
) {
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const rawSubtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const manualDiscountAmt = rawSubtotal > 0
    ? (discountType === 'percentage' ? rawSubtotal * (Math.min(discount, 100) / 100) : Math.min(discount, rawSubtotal))
    : 0;

  // Apply discount engine
  let promoApplied: IDiscountResult | null = null;
  let engineDiscount = 0;
  if (discountRules && discountRules.length > 0) {
    promoApplied = calculateDiscount(
      items.map((i) => ({ productId: i.productId, categoryId: i.categoryId || '', quantity: i.quantity, unitPrice: i.price })),
      discountRules,
      promoCode,
    );
    engineDiscount = promoApplied.totalDiscount;
  }

  const totalDiscountAmount = manualDiscountAmt + engineDiscount;
  const cappedDiscount = Math.min(totalDiscountAmount, rawSubtotal);

  if (!taxConfig || !taxConfig.taxEnabled) {
    return {
      items, itemCount,
      subtotal: rawSubtotal,
      serviceCharge: 0, serviceChargeName: 'Service Charge',
      tax: 0, taxName: 'Pajak', taxBreakdown: [],
      displayBreakdown: [], inclusiveTax: 0,
      discount, discountType,
      discountAmount: cappedDiscount,
      promoCode: promoCode || '',
      promoApplied,
      discountRules: discountRules || [],
      total: Math.max(0, rawSubtotal - cappedDiscount),
    };
  }

  // Pass total discount as nominal to tax calculator
  const result = calculateTax({
    items: items.map((i) => ({
      productId: i.productId,
      categoryId: i.categoryId || '',
      quantity: i.quantity,
      unitPrice: i.price,
      pricingMode: i.pricingMode,
    })),
    discount: cappedDiscount,
    discountType: 'nominal',
  }, taxConfig);

  const scRule = taxConfig.versions
    .find((v) => v.id === taxConfig.activeVersionId)
    ?.rules.find((r) => r.taxType === 'service_charge');
  const serviceChargeName = scRule?.name ?? 'Service Charge';

  const firstTax = result.taxBreakdown[0];
  const taxName = firstTax?.name ?? 'Pajak';

  // Compute per-item tax to split inclusive vs exclusive
  const hasAnyInclusive = items.some((i) => i.pricingMode === 'inclusive');
  const hasAnyExclusive = items.some((i) => i.pricingMode !== 'inclusive');
  const isMixed = hasAnyInclusive && hasAnyExclusive;

  let displayBreakdown: TaxBreakdownItem[] = result.taxBreakdown;
  let inclusiveTax = 0;

  if (isMixed) {
    // For mixed carts: recalculate per-item to separate inclusive vs exclusive
    const globalMode = taxConfig.pricingMode;
    const exclusiveItemsResult = calculateTax({
      items: items
        .filter((i) => (i.pricingMode ?? globalMode) === 'exclusive')
        .map((i) => ({
          productId: i.productId,
          categoryId: i.categoryId || '',
          quantity: i.quantity,
          unitPrice: i.price,
          pricingMode: 'exclusive' as const,
        })),
      discount: 0,
      discountType: 'nominal' as const,
    }, taxConfig);
    displayBreakdown = exclusiveItemsResult.taxBreakdown;

    const inclusiveItemsResult = calculateTax({
      items: items
        .filter((i) => (i.pricingMode ?? globalMode) === 'inclusive')
        .map((i) => ({
          productId: i.productId,
          categoryId: i.categoryId || '',
          quantity: i.quantity,
          unitPrice: i.price,
          pricingMode: 'inclusive' as const,
        })),
      discount: 0,
      discountType: 'nominal' as const,
    }, taxConfig);
    inclusiveTax = inclusiveItemsResult.totalTax;
  } else if (hasAnyInclusive) {
    // All inclusive: show nothing in breakdown (tax is in the price)
    displayBreakdown = [];
    inclusiveTax = result.totalTax;
  }
  // All exclusive: show full breakdown as-is

  return {
    items,
    itemCount,
    subtotal: result.subtotal,
    serviceCharge: result.serviceCharge,
    serviceChargeName,
    tax: result.totalTax,
    taxName,
    taxBreakdown: result.taxBreakdown,
    displayBreakdown,
    inclusiveTax,
    discount,
    discountType,
    discountAmount: cappedDiscount,
    promoCode: promoCode || '',
    promoApplied,
    discountRules: discountRules || [],
    total: result.grandTotal,
  };
}

export const usePOSStore = create<POSState>((set) => ({
  items: [],
  itemCount: 0,
  subtotal: 0,
  serviceCharge: 0,
  serviceChargeName: 'Service Charge',
  tax: 0,
  taxName: 'Pajak',
  taxBreakdown: [],
  displayBreakdown: [],
  inclusiveTax: 0,
  discount: 0,
  discountType: 'nominal',
  discountAmount: 0,
  promoCode: '',
  promoApplied: null,
  discountRules: [],
  total: 0,
  paymentModalOpen: false,
  paymentState: 'idle',
  receipt: null,
  taxConfig: null,
  customerName: '',
  tableNumber: '',
  heldOrders: [],
  heldOrdersPanelOpen: false,

  splitNumber: 0,
  splitBaseOrderNumber: null,

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);
      if (existing) {
        return derive(
          state.items.map((i) =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i,
          ),
          state.discount,
          state.discountType,
          state.taxConfig,
          state.discountRules,
          state.promoCode,
        );
      }
      return derive(
        [...state.items, { ...item, quantity: item.quantity ?? 1 }],
        state.discount,
        state.discountType,
        state.taxConfig,
        state.discountRules,
        state.promoCode,
      );
    }),

  removeItem: (productId) =>
    set((state) => derive(
      state.items.filter((i) => i.productId !== productId),
      state.discount, state.discountType, state.taxConfig,
      state.discountRules, state.promoCode,
    )),

  updateQuantity: (productId, delta) =>
    set((state) =>
      derive(
        state.items
          .map((i) =>
            i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
          )
          .filter((i) => i.quantity > 0),
        state.discount,
        state.discountType,
        state.taxConfig,
        state.discountRules,
        state.promoCode,
      ),
    ),

  setItemNotes: (productId, notes) =>
    set((state) => ({
      ...state,
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, notes } : i,
      ),
    })),

  setDiscount: (value, type) =>
    set((state) => derive(state.items, value, type, state.taxConfig, state.discountRules, state.promoCode)),

  setPromoCode: (code) =>
    set((state) => derive(state.items, state.discount, state.discountType, state.taxConfig, state.discountRules, code)),

  setDiscountRules: (rules) =>
    set((state) => derive(state.items, state.discount, state.discountType, state.taxConfig, rules, state.promoCode)),

  setTaxConfig: (config) => {
    set((state) => ({
      taxConfig: config,
      ...derive(state.items, state.discount, state.discountType, config, state.discountRules, state.promoCode),
    }));
  },

  setCustomerName: (name) => set({ customerName: name }),
  setTableNumber: (table) => set({ tableNumber: table }),

  clearCart: () =>
    set({
      items: [], itemCount: 0, subtotal: 0,
      serviceCharge: 0, serviceChargeName: 'Service Charge',
      tax: 0, taxName: 'Pajak', taxBreakdown: [],
      displayBreakdown: [], inclusiveTax: 0,
      discount: 0, discountType: 'nominal', discountAmount: 0,
      promoCode: '', promoApplied: null, discountRules: [],
      total: 0,
      receipt: null, paymentState: 'idle',
      customerName: '', tableNumber: '',
      splitNumber: 0, splitBaseOrderNumber: null,
    }),

  openPaymentModal: () => set({ paymentModalOpen: true }),
  closePaymentModal: () => set({ paymentModalOpen: false, paymentState: 'idle' }),

  setPaymentState: (paymentState) => set({ paymentState }),
  setReceipt: (receipt) => set((state) => ({
    receipt: {
      ...receipt,
      taxBreakdown: state.taxBreakdown,
      totalTax: state.tax,
      serviceCharge: state.serviceCharge,
      grandTotal: state.total,
    },
    paymentState: 'success',
    paymentModalOpen: false,
  })),
  clearReceipt: () => set({ receipt: null }),

  holdOrder: async () => {
    const state = usePOSStore.getState();
    if (state.items.length === 0) return;

    const snapshotItems = [...state.items];
    const snapshotTotal = state.total;
    const snapshotSubtotal = state.subtotal;
    const snapshotTax = state.tax;
    const snapshotServiceCharge = state.serviceCharge;
    const snapshotCustomerName = state.customerName;
    const snapshotTableNumber = state.tableNumber;
    const tempId = `hold-${Date.now()}`;

    const heldOrder: HeldOrder = {
      id: tempId,
      orderNumber: `HOLD-${Date.now().toString(36).toUpperCase()}`,
      items: snapshotItems,
      total: snapshotTotal,
      subtotal: snapshotSubtotal,
      tax: snapshotTax,
      serviceCharge: snapshotServiceCharge,
      customerName: snapshotCustomerName,
      tableNumber: snapshotTableNumber,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      heldOrders: [...s.heldOrders, heldOrder],
    }));
    usePOSStore.getState().clearCart();

    try {
      const { api } = await import('../../../@shared/services/api');
      const res = await api.post('/orders', {
        items: snapshotItems.map((i) => ({
          productId: i.productId,
          productName: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          totalPrice: i.price * i.quantity,
          modifiers: [],
          tax: { rate: 0, amount: 0 },
        })),
        customerName: snapshotCustomerName || null,
        tableNumber: snapshotTableNumber || null,
        source: 'pos',
        transactionType: 'dine_in',
        notes: '',
      });
      const realOrderId = res.data.data.id;
      const realOrderNumber = res.data.data.orderNumber;

      await api.post(`/orders/${realOrderId}/hold`);

      set((s) => ({
        heldOrders: s.heldOrders.map((o) =>
          o.id === tempId ? { ...o, id: realOrderId, orderNumber: realOrderNumber } : o,
        ),
      }));
    } catch {
      // local held order stays, cashier can recall later
    }
  },

  recallOrder: (heldOrder: HeldOrder) => {
    const state = usePOSStore.getState();
    if (state.items.length > 0) {
      const confirmed = window.confirm('Pesanan saat ini akan digantikan. Lanjutkan?');
      if (!confirmed) return;
    }

    state.clearCart();

    for (const item of heldOrder.items) {
      usePOSStore.getState().addItem(item);
    }

    set((s) => ({
      heldOrders: s.heldOrders.filter((o) => o.id !== heldOrder.id),
      customerName: heldOrder.customerName || '',
      tableNumber: heldOrder.tableNumber || '',
    }));

    // Background: notify backend
    if (!heldOrder.id.startsWith('hold-')) {
      import('../../../@shared/services/api').then(({ api }) =>
        api.patch(`/orders/${heldOrder.id}/recall`).catch(() => {}),
      );
    }
  },

  dismissHeldOrder: (orderId: string) => {
    set((s) => ({
      heldOrders: s.heldOrders.filter((o) => o.id !== orderId),
    }));
  },

  loadHeldOrders: async (tenantId: string) => {
    try {
      const { api } = await import('../../../@shared/services/api');
      const res = await api.get('/orders', { params: { status: 'held', limit: 50 } });
      const orders = res.data.data || [];
      const heldOrders: HeldOrder[] = orders.map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        items: (o.items || []).map((item: any) => ({
          productId: item.productId,
          name: item.productName,
          price: item.unitPrice,
          quantity: item.quantity,
        })),
        total: o.total,
        subtotal: o.subtotal,
        tax: o.tax,
        serviceCharge: o.serviceCharge,
        customerName: o.customerName || '',
        tableNumber: o.tableNumber || '',
        createdAt: o.createdAt,
      }));
      set({ heldOrders });
    } catch {
      // silent fail
    }
  },

  toggleHeldOrdersPanel: () => set((s) => ({ heldOrdersPanelOpen: !s.heldOrdersPanelOpen })),

  removeItems: (productIds) =>
    set((state) => {
      const remaining = state.items.filter((i) => !productIds.includes(i.productId));
      return {
        ...derive(remaining, state.discount, state.discountType, state.taxConfig, state.discountRules, state.promoCode),
        splitNumber: remaining.length === 0 ? 0 : state.splitNumber,
        splitBaseOrderNumber: remaining.length === 0 ? null : state.splitBaseOrderNumber,
      };
    }),

  resetSplit: () => set({ splitNumber: 0, splitBaseOrderNumber: null }),
}));
