import { describe, it, expect, beforeEach } from 'vitest';
import { usePOSStore } from '../../src/core/pos/store/posStore';

describe('POS Store', () => {
  beforeEach(() => {
    usePOSStore.setState({ items: [], itemCount: 0, subtotal: 0, tax: 0, total: 0, paymentModalOpen: false, paymentState: 'idle', receipt: null });
  });

  const sampleItem = { productId: 'p1', name: 'Kopi Gula Aren', price: 25000, imageUrl: '' };

  describe('addItem', () => {
    it('adds new item to cart', () => {
      usePOSStore.getState().addItem(sampleItem);

      const state = usePOSStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].quantity).toBe(1);
      expect(state.itemCount).toBe(1);
    });

    it('increments quantity if item already exists', () => {
      usePOSStore.getState().addItem(sampleItem);
      usePOSStore.getState().addItem(sampleItem);

      const state = usePOSStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].quantity).toBe(2);
      expect(state.itemCount).toBe(2);
    });

    it('calculates subtotal correctly for multiple items', () => {
      usePOSStore.getState().addItem(sampleItem);
      usePOSStore.getState().addItem({ productId: 'p2', name: 'Teh Manis', price: 10000, imageUrl: '' });

      const state = usePOSStore.getState();
      expect(state.subtotal).toBe(35000);
      expect(state.items).toHaveLength(2);
    });
  });

  describe('removeItem', () => {
    it('removes item from cart', () => {
      usePOSStore.getState().addItem(sampleItem);
      usePOSStore.getState().addItem({ productId: 'p2', name: 'Teh Manis', price: 10000, imageUrl: '' });
      usePOSStore.getState().removeItem('p1');

      const state = usePOSStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].productId).toBe('p2');
    });
  });

  describe('updateQuantity', () => {
    it('increases quantity with positive delta', () => {
      usePOSStore.getState().addItem(sampleItem);
      usePOSStore.getState().updateQuantity('p1', 2);

      expect(usePOSStore.getState().items[0].quantity).toBe(3);
    });

    it('decreases quantity with negative delta', () => {
      usePOSStore.getState().addItem(sampleItem);
      usePOSStore.getState().addItem({ productId: 'p2', name: 'Teh Manis', price: 10000, imageUrl: '' });
      usePOSStore.getState().updateQuantity('p1', -1);

      expect(usePOSStore.getState().items).toHaveLength(1);
      expect(usePOSStore.getState().items[0].productId).toBe('p2');
    });

    it('removes item when quantity reaches zero', () => {
      usePOSStore.getState().addItem(sampleItem);
      usePOSStore.getState().updateQuantity('p1', -1);

      expect(usePOSStore.getState().items).toHaveLength(0);
    });
  });

  describe('clearCart', () => {
    it('resets cart to initial state', () => {
      usePOSStore.getState().addItem(sampleItem);
      usePOSStore.getState().clearCart();

      const state = usePOSStore.getState();
      expect(state.items).toHaveLength(0);
      expect(state.itemCount).toBe(0);
      expect(state.subtotal).toBe(0);
      expect(state.receipt).toBeNull();
    });
  });

  describe('tax calculation', () => {
    it('applies 10% tax rate', () => {
      usePOSStore.getState().addItem(sampleItem);

      const state = usePOSStore.getState();
      expect(state.tax).toBe(2500);
      expect(state.total).toBe(27500);
    });
  });

  describe('payment flow', () => {
    it('opens and closes payment modal', () => {
      usePOSStore.getState().openPaymentModal();
      expect(usePOSStore.getState().paymentModalOpen).toBe(true);

      usePOSStore.getState().closePaymentModal();
      expect(usePOSStore.getState().paymentModalOpen).toBe(false);
    });

    it('sets receipt after successful payment', () => {
      const receipt = { orderNumber: 'ORD-001', paid: 50000, change: 5000 };
      usePOSStore.getState().setReceipt(receipt);

      const state = usePOSStore.getState();
      expect(state.receipt).toEqual(receipt);
      expect(state.paymentState).toBe('success');
      expect(state.paymentModalOpen).toBe(false);
    });
  });
});
