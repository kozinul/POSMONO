import { create } from 'zustand';
import type { IDiscountRule } from '../../../@shared/hooks/useDiscountConfiguration';
import type { PricingResult } from '../../../@shared/hooks/usePricing';
import { api } from '../../../@shared/services/api';
import { useAuthStore } from '../../../@shared/hooks/useAuth';
import { toast } from '../../../@shared/hooks/useToast';

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
  isFreeItem?: boolean;
  freeByRuleId?: string;
  stock?: number;
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

export interface ReceiptLayout {
  paper: Record<string, unknown>;
  pages: { width: number; height: number; nodes: Array<Record<string, unknown>> }[];
}

interface Receipt {
  orderNumber: string;
  displayOrderNumber: string;
  paid: number;
  change: number;
  grandTotal: number;
  paidItems: CartItem[];
  hasRemaining: boolean;
  createdAt: string;
  layout?: ReceiptLayout | null;
  thermal?: string | null;
  pdf?: string | null;
  templateName?: string | null;
  pricing?: PricingResult | null;
}

export interface ShiftPaymentBreakdownEntry {
  method: string;
  code: string;
  amount: number;
}

export interface ShiftTotals {
  totalSales: number;
  cashSales: number;
  nonCashSales: number;
  totalTransactions: number;
  paymentBreakdown: ShiftPaymentBreakdownEntry[];
}

export interface OpenShiftSnapshot {
  id: string;
  totalSales: number;
  cashSales: number;
  nonCashSales: number;
  totalTransactions: number;
  paymentBreakdown?: ShiftPaymentBreakdownEntry[];
}

export const EMPTY_SHIFT_TOTALS: ShiftTotals = {
  totalSales: 0,
  cashSales: 0,
  nonCashSales: 0,
  totalTransactions: 0,
  paymentBreakdown: [],
};

interface POSState {
  items: CartItem[];
  pricing: PricingResult | null;
  pricingLoading: boolean;
  promoCode: string;
  manualDiscount: number;
  manualDiscountType: 'percentage' | 'nominal';
  discountRules: IDiscountRule[];
  productPrices: Record<string, number>;

  openShiftId: string | null;
  shiftTotals: ShiftTotals;

  paymentModalOpen: boolean;
  paymentState: PaymentState;
  receipt: Receipt | null;

  customerName: string;
  tableNumber: string;

  heldOrders: HeldOrder[];
  heldOrdersPanelOpen: boolean;
  dismissedHeldOrderIds: string[];

  activeBillId: string | null;
  activeBillNumber: string | null;

  splitNumber: number;
  splitBaseOrderNumber: string | null;

  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  setItemNotes: (productId: string, notes: string) => void;
  setManualDiscount: (value: number, type: 'percentage' | 'nominal') => void;
  setPromoCode: (code: string) => void;
  setDiscountRules: (rules: IDiscountRule[]) => void;
  setProductPrices: (prices: Record<string, number>) => void;
  refreshItemPrices: (prices: Record<string, number>) => boolean;
  clearCart: () => void;
  recalculate: () => Promise<void>;
  setCustomerName: (name: string) => void;
  setTableNumber: (table: string) => void;

  seedOpenShift: (shift: OpenShiftSnapshot | null) => void;
  registerShiftPayment: (input: { total: number; method: string; isCash: boolean }) => void;

  openPaymentModal: () => void;
  closePaymentModal: () => void;
  setPaymentState: (state: PaymentState) => void;
  setReceipt: (receipt: Receipt) => void;
  clearReceipt: () => void;

  dismissHeldOrder: (orderId: string) => void;
  mergeHeldOrders: (orders: HeldOrder[]) => void;
  toggleHeldOrdersPanel: () => void;

  openBill: () => Promise<void>;
  saveBill: () => Promise<boolean>;
  tapBill: (heldOrder: HeldOrder) => void;
  cancelActiveBill: () => void;
  closeBillAfterPayment: () => Promise<void>;

  removeItems: (productIds: string[]) => void;
  resetSplit: () => void;
  registerSplitPayment: (baseOrderNumber?: string) => void;
}

let recalcTimer: ReturnType<typeof setTimeout> | null = null;
let recalcToken = 0;

function scheduleRecalculation(get: () => POSState, set: (fn: (s: POSState) => Partial<POSState>) => void) {
  if (recalcTimer) clearTimeout(recalcTimer);
  recalcTimer = setTimeout(() => {
    get().recalculate();
  }, 50);
}

function mergePaymentBreakdown(
  current: ShiftPaymentBreakdownEntry[],
  method: string,
  amount: number,
): ShiftPaymentBreakdownEntry[] {
  const roundMoney = (value: number) => Math.round(value * 100) / 100;
  const existing = current.find((e) => e.method === method);
  if (existing) {
    return current.map((e) =>
      e.method === method ? { ...e, amount: roundMoney(e.amount + amount) } : e,
    );
  }
  return [...current, { method, code: method, amount: roundMoney(amount) }];
}

export const usePOSStore = create<POSState>((set, get) => ({
  items: [],
  pricing: null,
  pricingLoading: false,
  promoCode: '',
  manualDiscount: 0,
  manualDiscountType: 'nominal',
  discountRules: [],
  productPrices: {},

  paymentModalOpen: false,
  paymentState: 'idle',
  receipt: null,

  customerName: '',
  tableNumber: '',

  heldOrders: [],
  heldOrdersPanelOpen: false,
  dismissedHeldOrderIds: [],

  activeBillId: null,
  activeBillNumber: null,

  splitNumber: 0,
  splitBaseOrderNumber: null,

  openShiftId: null,
  shiftTotals: { ...EMPTY_SHIFT_TOTALS },

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId && !i.isFreeItem);
      const currentQty = existing?.quantity ?? 0;
      if (item.stock !== undefined && item.stock > 0 && currentQty >= item.stock) {
        return state;
      }
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === item.productId && !i.isFreeItem
              ? { ...i, quantity: i.quantity + 1, stock: item.stock ?? i.stock }
              : i,
          ),
        };
      }
      return {
        items: [...state.items, { ...item, quantity: item.quantity ?? 1 }],
      };
    });
    scheduleRecalculation(get, set);
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    }));
    scheduleRecalculation(get, set);
  },

  updateQuantity: (productId, delta) => {
    set((state) => ({
      items: state.items
        .map((i) => {
          if (i.productId !== productId || i.isFreeItem) return i;
          if (!i.isFreeItem && i.stock !== undefined && i.stock > 0) {
            return { ...i, quantity: Math.min(Math.max(0, i.quantity + delta), i.stock) };
          }
          return { ...i, quantity: Math.max(0, i.quantity + delta) };
        })
        .filter((i) => i.quantity > 0),
    }));
    scheduleRecalculation(get, set);
  },

  setItemNotes: (productId, notes) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, notes } : i,
      ),
    })),

  setManualDiscount: (value, type) => {
    set({ manualDiscount: value, manualDiscountType: type });
    scheduleRecalculation(get, set);
  },

  setPromoCode: (code) => {
    set({ promoCode: code });
    scheduleRecalculation(get, set);
  },

  setDiscountRules: (rules) => set({ discountRules: rules }),

  setProductPrices: (prices) => set({ productPrices: prices }),

  refreshItemPrices: (prices) => {
    let changed = false;
    set((s) => {
      const items = s.items.map((i) => {
        if (i.isFreeItem) return i;
        const p = prices[i.productId];
        if (p !== undefined && p !== i.price) {
          changed = true;
          return { ...i, price: p };
        }
        return i;
      });
      return changed ? { items } : {};
    });
    return changed;
  },

  clearCart: () =>
    set({
      items: [],
      pricing: null,
      promoCode: '',
      manualDiscount: 0,
      manualDiscountType: 'nominal',
      receipt: null,
      paymentState: 'idle',
      customerName: '',
      tableNumber: '',
      activeBillId: null,
      activeBillNumber: null,
      splitNumber: 0,
      splitBaseOrderNumber: null,
    }),

  recalculate: async () => {
    const state = get();

    // Fold same-product free lines into the paid line's total so the backend
    // prices the REAL quantity (paid + already-free items). Sending only the
    // paid quantity caused "beli 3 bayar 2"-style promos to cap at one free
    // item: each add beyond the threshold was re-consumed as the free item and
    // the order could never grow past a single qualifying set.
    // Free *gifts* (products not originally in the cart) are NOT sent — they are
    // regenerated by the backend from the promo rule.
    const freeQtyByProduct = new Map<string, number>();
    for (const item of state.items) {
      if (item.isFreeItem) {
        freeQtyByProduct.set(item.productId, (freeQtyByProduct.get(item.productId) ?? 0) + item.quantity);
      }
    }

    const cartAgg = new Map<
      string,
      {
        productId: string;
        productName: string;
        categoryId: string;
        unitPrice: number;
        quantity: number;
        pricingMode?: 'inclusive' | 'exclusive';
        paidItem: CartItem | undefined;
      }
    >();
    for (const item of state.items) {
      if (item.isFreeItem) continue;
      const existing = cartAgg.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        cartAgg.set(item.productId, {
          productId: item.productId,
          productName: item.name,
          categoryId: item.categoryId || '',
          unitPrice: item.price,
          quantity: item.quantity + (freeQtyByProduct.get(item.productId) ?? 0),
          pricingMode: item.pricingMode,
          paidItem: item,
        });
      }
    }

    const totalQty = Array.from(cartAgg.values()).reduce((s, a) => s + a.quantity, 0);
    if (totalQty === 0) {
      set({ pricing: null, pricingLoading: false, items: state.items.filter((i) => !i.isFreeItem) });
      return;
    }

    set({ pricingLoading: true });
    const token = ++recalcToken;
    try {
      const { data } = await api.post('/pricing/calculate', {
        items: Array.from(cartAgg.values()).map((a) => ({
          productId: a.productId,
          productName: a.productName,
          categoryId: a.categoryId,
          quantity: a.quantity,
          unitPrice: a.unitPrice,
          pricingMode: a.pricingMode,
        })),
        promoCode: state.promoCode || undefined,
        manualDiscount: state.manualDiscount || undefined,
        manualDiscountType: state.manualDiscount > 0 ? state.manualDiscountType : undefined,
      });

      // Drop stale responses — a newer recalculation was triggered while this
      // one was in flight, so applying it would clobber the user's latest adds.
      if (token !== recalcToken) return;

      const freeByProduct = new Map<string, { quantity: number; productName: string; categoryId: string; freeByRuleId?: string }>();
      for (const li of data.lineItems ?? []) {
        if (!li.isFreeItem) continue;
        const existing = freeByProduct.get(li.productId);
        if (existing) {
          existing.quantity += li.quantity;
        } else {
          freeByProduct.set(li.productId, {
            quantity: li.quantity,
            productName: li.productName,
            categoryId: li.categoryId,
            freeByRuleId: li.freeByRuleId,
          });
        }
      }

      const newItems: CartItem[] = [];
      const freeItems: CartItem[] = [];
      for (const [, agg] of cartAgg) {
        const totalQty = agg.quantity;
        const freeInfo = freeByProduct.get(agg.productId);
        const freeQty = Math.min(freeInfo ? freeInfo.quantity : 0, totalQty);
        const paidQty = totalQty - freeQty;

        if (paidQty > 0 && agg.paidItem) {
          newItems.push({ ...agg.paidItem, quantity: paidQty });
        }
        if (freeQty > 0) {
          freeItems.push({
            productId: agg.productId,
            name: agg.productName,
            price: 0,
            quantity: freeQty,
            categoryId: agg.categoryId,
            pricingMode: agg.pricingMode,
            isFreeItem: true,
            freeByRuleId: freeInfo?.freeByRuleId,
            notes: agg.paidItem?.notes,
          });
          freeByProduct.delete(agg.productId);
        }
      }

      // Remaining entries are free gifts not present as paid lines in the cart.
      for (const [productId, info] of freeByProduct) {
        freeItems.push({
          productId,
          name: info.productName,
          price: 0,
          quantity: info.quantity,
          categoryId: info.categoryId,
          isFreeItem: true,
          freeByRuleId: info.freeByRuleId,
        });
      }

      set({ pricing: data, items: [...newItems, ...freeItems], pricingLoading: false });
    } catch {
      if (token === recalcToken) set({ pricingLoading: false });
    }
  },

  setCustomerName: (name) => set({ customerName: name }),
  setTableNumber: (table) => set({ tableNumber: table }),

  seedOpenShift: (shift) => {
    const state = get();
    const id = shift?.id ?? null;
    if (id === state.openShiftId) return;
    set({
      openShiftId: id,
      shiftTotals: shift
        ? {
            totalSales: shift.totalSales,
            cashSales: shift.cashSales,
            nonCashSales: shift.nonCashSales,
            totalTransactions: shift.totalTransactions,
            paymentBreakdown: [...(shift.paymentBreakdown ?? [])],
          }
        : { ...EMPTY_SHIFT_TOTALS },
    });
  },

  registerShiftPayment: ({ total, method, isCash }) => {
    const state = get();
    if (!state.openShiftId) return;

    const roundMoney = (value: number) => Math.round(value * 100) / 100;
    const next: ShiftTotals = {
      totalSales: roundMoney(state.shiftTotals.totalSales + total),
      cashSales: roundMoney(state.shiftTotals.cashSales + (isCash ? total : 0)),
      nonCashSales: roundMoney(state.shiftTotals.nonCashSales + (isCash ? 0 : total)),
      totalTransactions: state.shiftTotals.totalTransactions + 1,
      paymentBreakdown: mergePaymentBreakdown(state.shiftTotals.paymentBreakdown, method, total),
    };

    set({ shiftTotals: next });
    api
      .put(`/shifts/${state.openShiftId}/sales`, next)
      .catch(() => {});
  },

  openPaymentModal: () => set({ paymentModalOpen: true }),
  closePaymentModal: () => set({ paymentModalOpen: false, paymentState: 'idle' }),

  setPaymentState: (paymentState) => set({ paymentState }),
  setReceipt: (receipt) => set({ receipt, paymentState: 'success', paymentModalOpen: false }),
  clearReceipt: () => set({ receipt: null }),

  openBill: async () => {
    const state = usePOSStore.getState();
    if (state.items.length === 0) return;

    const snapshotItems = [...state.items];
    const snapshotCustomerName = state.customerName;
    const snapshotTableNumber = state.tableNumber;

    try {
      const res = await api.post('/orders', {
        items: snapshotItems
          .filter((i) => !i.isFreeItem)
          .map((i) => ({
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
      const billId = res.data.data.id;
      const billNumber = res.data.data.orderNumber;

      await api.post(`/orders/${billId}/hold`);

      const billData = res.data.data;
      const heldOrder: HeldOrder = {
        id: billData.id,
        orderNumber: billData.orderNumber,
        items: snapshotItems
          .filter((i) => !i.isFreeItem)
          .map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            categoryId: i.categoryId,
            pricingMode: i.pricingMode,
          })),
        total: billData.total,
        subtotal: billData.subtotal,
        tax: billData.tax,
        serviceCharge: billData.serviceCharge,
        customerName: snapshotCustomerName,
        tableNumber: snapshotTableNumber,
        createdAt: billData.createdAt,
      };

      set((s) => ({
        activeBillId: billId,
        activeBillNumber: billNumber,
        heldOrders: s.heldOrders.some((o) => o.id === billId)
          ? s.heldOrders
          : [...s.heldOrders, heldOrder],
      }));
    } catch {
      set({ customerName: snapshotCustomerName, tableNumber: snapshotTableNumber });
    }
  },

  saveBill: async (): Promise<boolean> => {
    const state = usePOSStore.getState();
    const billId = state.activeBillId;
    if (!billId || state.items.length === 0) return false;

    const paidItems = state.items.filter((i) => !i.isFreeItem);
    if (paidItems.length === 0) return false;

    try {
      await api.put(`/orders/${billId}/items`, {
        items: paidItems.map((i) => ({
          productId: i.productId,
          productName: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          totalPrice: Math.round(i.price * i.quantity * 100) / 100,
          modifiers: [],
          tax: { rate: 0, amount: 0 },
        })),
        tableNumber: state.tableNumber || null,
        customerName: state.customerName || null,
      });

      set((s) => ({
        heldOrders: s.heldOrders.map((o) =>
          o.id === billId
            ? {
                ...o,
                items: state.items.map((i) => ({
                  productId: i.productId,
                  name: i.name,
                  price: i.price,
                  quantity: i.quantity,
                  categoryId: i.categoryId,
                  pricingMode: i.pricingMode,
                  imageUrl: i.imageUrl,
                  stock: i.stock,
                  isFreeItem: i.isFreeItem,
                  freeByRuleId: i.freeByRuleId,
                })),
                customerName: state.customerName || o.customerName,
                tableNumber: state.tableNumber || o.tableNumber,
              }
            : o,
        ),
      }));

      toast({ title: 'Bill berhasil disimpan', icon: 'success' });
      return true;
    } catch {
      toast({ title: 'Gagal menyimpan bill', icon: 'error' });
      return false;
    }
  },

  tapBill: (heldOrder: HeldOrder) => {
    const state = usePOSStore.getState();
    if (state.items.length > 0) {
      const confirmed = window.confirm('Pesanan saat ini akan digantikan. Lanjutkan?');
      if (!confirmed) return;
    }

    state.clearCart();

    for (const item of heldOrder.items) {
      usePOSStore.getState().addItem(item);
    }

    const isTemp = heldOrder.id.startsWith('hold-');

    set({
      customerName: heldOrder.customerName || '',
      tableNumber: heldOrder.tableNumber || '',
      activeBillId: isTemp ? null : heldOrder.id,
      activeBillNumber: isTemp ? null : heldOrder.orderNumber,
    });
  },

  cancelActiveBill: () => {
    const state = usePOSStore.getState();
    const billId = state.activeBillId;
    if (!billId) return;

    set({
      activeBillId: null,
      activeBillNumber: null,
      splitNumber: 0,
      splitBaseOrderNumber: null,
    });

    if (!billId.startsWith('hold-')) {
      const userName = useAuthStore.getState().user?.displayName || 'Kasir';
      api
        .post(`/orders/${billId}/void`, { reason: 'Bill ditutup tanpa pembayaran', voidedByName: userName })
        .catch(() => {});
    }
  },

  closeBillAfterPayment: async () => {
    const state = usePOSStore.getState();
    const billId = state.activeBillId;

    if (!billId) {
      set({ splitNumber: 0, splitBaseOrderNumber: null });
      return;
    }

    set((s) => ({
      heldOrders: s.heldOrders.filter((o) => o.id !== billId),
      dismissedHeldOrderIds: s.dismissedHeldOrderIds.includes(billId)
        ? s.dismissedHeldOrderIds
        : [...s.dismissedHeldOrderIds, billId],
      activeBillId: null,
      activeBillNumber: null,
      splitNumber: 0,
      splitBaseOrderNumber: null,
    }));

    if (!billId.startsWith('hold-')) {
      const userName = useAuthStore.getState().user?.displayName || 'Kasir';
      api
        .post(`/orders/${billId}/void`, { reason: 'Bill ditutup setelah pembayaran', voidedByName: userName })
        .catch(() => {});
    }
  },

  dismissHeldOrder: (orderId: string) => {
    set((s) => ({
      heldOrders: s.heldOrders.filter((o) => o.id !== orderId),
      dismissedHeldOrderIds: s.dismissedHeldOrderIds.includes(orderId) ? s.dismissedHeldOrderIds : [...s.dismissedHeldOrderIds, orderId],
    }));
  },

  mergeHeldOrders: (orders) => {
    set((s) => {
      const remote = orders.filter((o) => !s.dismissedHeldOrderIds.includes(o.id));
      const local = s.heldOrders.filter((o) => o.id.startsWith('hold-'));
      const merged = [...remote, ...local];
      const currentKey = s.heldOrders.map((o) => `${o.id}:${o.total}`).join('|');
      const nextKey = merged.map((o) => `${o.id}:${o.total}`).join('|');
      if (currentKey === nextKey) return {};
      return { heldOrders: merged };
    });
  },

  toggleHeldOrdersPanel: () => set((s) => ({ heldOrdersPanelOpen: !s.heldOrdersPanelOpen })),

  removeItems: (productIds) => {
    set((state) => {
      const remaining = state.items.filter((i) => !productIds.includes(i.productId));
      return {
        items: remaining,
        splitNumber: remaining.length === 0 ? 0 : state.splitNumber,
        splitBaseOrderNumber: remaining.length === 0 ? null : state.splitBaseOrderNumber,
      };
    });
    scheduleRecalculation(get, set);
  },

  resetSplit: () => set({ splitNumber: 0, splitBaseOrderNumber: null }),

  registerSplitPayment: (baseOrderNumber?: string) =>
    set((s) => ({
      splitNumber: s.splitNumber + 1,
      splitBaseOrderNumber: s.splitBaseOrderNumber ?? s.activeBillNumber ?? baseOrderNumber ?? null,
    })),
}));
