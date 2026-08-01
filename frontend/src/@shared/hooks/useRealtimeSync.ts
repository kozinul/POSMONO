import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../services/socket';

const EVENT_TO_QUERY: Record<string, Array<Array<string>>> = {
  'catalog.product.created': [['products']],
  'catalog.product.updated': [['products']],
  'catalog.product.deleted': [['products']],
  'discount.config.updated': [['discount-config']],
  'tax.config.updated': [['tax-config']],
  'inventory.stock.adjusted': [['inventory']],
  'inventory.stock.low_alert': [['inventory']],
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

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
  }, [queryClient]);
}
