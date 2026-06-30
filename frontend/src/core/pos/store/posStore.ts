import { create } from 'zustand';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface POSState {
  items: CartItem[];
  total: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

export const usePOSStore = create<POSState>((set) => ({
  items: [],
  total: 0,
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);
      if (existing) {
        const items = state.items.map((i) =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i,
        );
        return {
          items,
          total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
        };
      }
      const items = [...state.items, { ...item, quantity: 1 }];
      return {
        items,
        total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      };
    }),
  removeItem: (productId) =>
    set((state) => {
      const items = state.items.filter((i) => i.productId !== productId);
      return {
        items,
        total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      };
    }),
  clearCart: () => set({ items: [], total: 0 }),
}));
