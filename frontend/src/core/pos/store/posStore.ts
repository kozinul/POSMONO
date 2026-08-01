import { create } from 'zustand';
import type { IDiscountRule } from '../../../@shared/hooks/useDiscountConfiguration';
import type { PricingResult, PricingLineItem } from '../../../@shared/hooks/usePricing';
import { api } from '../../../@shared/services/api';
import { useAuthStore } from '../../../@shared/hooks/useAuth';

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
}

interface POSState {
  items: CartItem[];
  pricing: PricingResult | null;
  pricingLoading: boolean;
  promoCode: string;
  manualDiscount: number;
  manualDiscountType: 'percentage' | 'nominal';
  discountRules: IDiscountRule[];
  productPrices: Record<string, number>;

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
}

let recalcTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRecalculation(get: () => POSState, set: (fn: (s: POSState) => Partial<POSState>) => void) {
  if (recalcTimer) clearTimeout(recalcTimer);
  recalcTimer = setTimeout(() => {
    get().recalculate();
  }, 50);
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
            i.productId === item.productId
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
          if (i.productId !== productId) return i;
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
    const paidItems = state.items.filter((i) => !i.isFreeItem);
    if (paidItems.length === 0) {
      set({ pricing: null, pricingLoading: false, items: state.items.filter((i) => !i.isFreeItem) });
      return;
    }

    set({ pricingLoading: true });
    try {
      const { data } = await api.post('/pricing/calculate', {
        items: paidItems.map((i) => ({
          productId: i.productId,
          productName: i.name,
          categoryId: i.categoryId || '',
          quantity: i.quantity,
          unitPrice: i.price,
          pricingMode: i.pricingMode,
        })),
        promoCode: state.promoCode || undefined,
        manualDiscount: state.manualDiscount || undefined,
        manualDiscountType: state.manualDiscount > 0 ? state.manualDiscountType : undefined,
      });

      const freeItems: CartItem[] = [];
      const updatedItems = state.items
        .filter((i) => !i.isFreeItem)
        .map((item) => {
          const freeLi = data.lineItems?.find(
            (li: PricingLineItem) => li.productId === item.productId && li.isFreeItem
          );
          if (freeLi) {
            freeItems.push({
              productId: item.productId,
              name: item.name,
              price: 0,
              quantity: freeLi.quantity,
              categoryId: item.categoryId,
              pricingMode: item.pricingMode,
              isFreeItem: true,
              freeByRuleId: freeLi.freeByRuleId,
            });
          return { ...item, quantity: item.quantity - freeLi.quantity };
        }
        return item;
      })
      .filter((i) => i.quantity > 0);

      for (const li of data.lineItems ?? []) {
        if (
          li.isFreeItem &&
          !updatedItems.some((i) => i.productId === li.productId) &&
          !freeItems.some((i) => i.productId === li.productId)
        ) {
          freeItems.push({
            productId: li.productId,
            name: li.productName,
            price: 0,
            quantity: li.quantity,
            categoryId: li.categoryId,
            isFreeItem: true,
            freeByRuleId: li.freeByRuleId,
          });
        }
      }

      set({ pricing: data, items: [...updatedItems, ...freeItems], pricingLoading: false });
    } catch {
      set({ pricingLoading: false });
    }
  },

  setCustomerName: (name) => set({ customerName: name }),
  setTableNumber: (table) => set({ tableNumber: table }),

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

      set((s) => ({
        activeBillId: billId,
        activeBillNumber: billNumber,
        dismissedHeldOrderIds: s.dismissedHeldOrderIds.includes(billId)
          ? s.dismissedHeldOrderIds
          : [...s.dismissedHeldOrderIds, billId],
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
      return true;
    } catch {
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

    set((s) => ({
      heldOrders: s.heldOrders.filter((o) => o.id !== heldOrder.id),
      customerName: heldOrder.customerName || '',
      tableNumber: heldOrder.tableNumber || '',
      activeBillId: isTemp ? null : heldOrder.id,
      activeBillNumber: isTemp ? null : heldOrder.orderNumber,
      dismissedHeldOrderIds: isTemp || s.dismissedHeldOrderIds.includes(heldOrder.id)
        ? s.dismissedHeldOrderIds
        : [...s.dismissedHeldOrderIds, heldOrder.id],
    }));
  },

  cancelActiveBill: () => {
    const state = usePOSStore.getState();
    const billId = state.activeBillId;
    if (!billId) return;

    set({ activeBillId: null, activeBillNumber: null });

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
    if (!billId) return;

    set((s) => ({
      heldOrders: s.heldOrders.filter((o) => o.id !== billId),
      dismissedHeldOrderIds: s.dismissedHeldOrderIds.includes(billId)
        ? s.dismissedHeldOrderIds
        : [...s.dismissedHeldOrderIds, billId],
      activeBillId: null,
      activeBillNumber: null,
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
      const current = s.heldOrders.map((o) => o.id).join('|');
      const next = merged.map((o) => o.id).join('|');
      if (current === next) return {};
      return { heldOrders: merged };
    });
  },

  toggleHeldOrdersPanel: () => set((s) => ({ heldOrdersPanelOpen: !s.heldOrdersPanelOpen })),

  removeItems: (productIds) =>
    set((state) => ({
      items: state.items.filter((i) => !productIds.includes(i.productId)),
      splitNumber: state.items.filter((i) => !productIds.includes(i.productId)).length === 0 ? 0 : state.splitNumber,
      splitBaseOrderNumber: state.items.filter((i) => !productIds.includes(i.productId)).length === 0 ? null : state.splitBaseOrderNumber,
    })),

  resetSplit: () => set({ splitNumber: 0, splitBaseOrderNumber: null }),
}));
