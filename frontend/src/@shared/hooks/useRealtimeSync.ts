import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, disconnectSocket } from '../services/socket';
import { useAuthStore } from './useAuth';

const EVENT_TO_QUERY: Record<string, Array<Array<string>>> = {
  // Catalog
  'catalog.product.created': [['products']],
  'catalog.product.updated': [['products']],
  'catalog.product.deleted': [['products']],
  'catalog.product.price.changed': [['products']],
  // Discount & tax config
  'discount.config.updated': [['discount-config']],
  'tax.config.updated': [['tax-config']],
  // Inventory
  'inventory.stock.adjusted': [['inventory']],
  'inventory.stock.low_alert': [['inventory']],
  // Ordering
  'ordering.order.created': [['held-orders']],
  'ordering.order.held': [['held-orders']],
  'ordering.order.recalled': [['held-orders']],
  'ordering.order.updated': [['held-orders']],
  'ordering.order.voided': [['held-orders']],
  'ordering.order.cancelled': [['held-orders']],
  // Payment & POS
  'ordering.order.paid': [['inventory']],
  'payment.transaction.completed': [['inventory']],
  'pos.sale.completed': [['inventory']],
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    const handler = (event: { eventName: string }) => {
      const keys = EVENT_TO_QUERY[event.eventName];
      if (keys) {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    };

    socket.on('domain-event', handler);

    return () => {
      socket.off('domain-event', handler);
    };
  }, [queryClient, isAuthenticated]);
}
