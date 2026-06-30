import { create } from 'zustand';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  notes?: string;
}

export type PaymentState = 'idle' | 'processing' | 'success' | 'error';

interface Receipt {
  orderNumber: string;
  paid: number;
  change: number;
}

interface POSState {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  tax: number;
  total: number;
  paymentModalOpen: boolean;
  paymentState: PaymentState;
  receipt: Receipt | null;

  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  setItemNotes: (productId: string, notes: string) => void;
  clearCart: () => void;

  openPaymentModal: () => void;
  closePaymentModal: () => void;
  setPaymentState: (state: PaymentState) => void;
  setReceipt: (receipt: Receipt) => void;
  clearReceipt: () => void;
}

const TAX_RATE = 0.1;

function derive(items: CartItem[]) {
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  return { items, itemCount, subtotal, tax, total: subtotal + tax };
}

export const usePOSStore = create<POSState>((set) => ({
  items: [],
  itemCount: 0,
  subtotal: 0,
  tax: 0,
  total: 0,
  paymentModalOpen: false,
  paymentState: 'idle',
  receipt: null,

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);
      if (existing) {
        return derive(
          state.items.map((i) =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        );
      }
      return derive([...state.items, { ...item, quantity: 1 }]);
    }),

  removeItem: (productId) =>
    set((state) => derive(state.items.filter((i) => i.productId !== productId))),

  updateQuantity: (productId, delta) =>
    set((state) =>
      derive(
        state.items
          .map((i) =>
            i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
          )
          .filter((i) => i.quantity > 0),
      ),
    ),

  setItemNotes: (productId, notes) =>
    set((state) => ({
      ...state,
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, notes } : i,
      ),
    })),

  clearCart: () =>
    set({ items: [], itemCount: 0, subtotal: 0, tax: 0, total: 0, receipt: null, paymentState: 'idle' }),

  openPaymentModal: () => set({ paymentModalOpen: true }),
  closePaymentModal: () => set({ paymentModalOpen: false, paymentState: 'idle' }),

  setPaymentState: (paymentState) => set({ paymentState }),
  setReceipt: (receipt) => set({ receipt, paymentState: 'success', paymentModalOpen: false }),
  clearReceipt: () => set({ receipt: null }),
}));
